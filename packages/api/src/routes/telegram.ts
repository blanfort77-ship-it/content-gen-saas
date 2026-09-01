import { randomUUID } from "node:crypto";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { SECOND_PASS_SYSTEM_PROMPT } from "../secondPassPrompt.js";

export const telegramRouter = Router();

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4000; // Telegram's real limit is 4096; leave headroom.
const AUDIT_PRICE_STARS = 15; // ~$0.15-0.20 net after Telegram/Fragment fees.
const PENDING_DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes.

const WELCOME_TEXT =
  "Send me a draft — an article, code, or report — and I'll audit it for accuracy before you publish it. " +
  `Each audit costs ${AUDIT_PRICE_STARS} Telegram Stars, paid through Telegram's own payment flow. ` +
  "I inventory every verifiable claim, check internal consistency and code logic by reasoning through it, " +
  "and flag anything that would need external verification instead of guessing. " +
  "No live web access or code execution in this version — I'll say so explicitly when I can't check something here.";

interface TelegramSuccessfulPayment {
  invoice_payload: string;
}

interface TelegramMessage {
  chat: { id: number };
  text?: string;
  successful_payment?: TelegramSuccessfulPayment;
}

interface TelegramPreCheckoutQuery {
  id: string;
  invoice_payload: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  pre_checkout_query?: TelegramPreCheckoutQuery;
}

interface PendingDraft {
  chatId: number;
  text: string;
  createdAt: number;
}

// In-memory only: fine for a single-instance service. If the process
// restarts between invoice and payment, that one pending audit is lost —
// the user gets told to resend rather than the bot silently failing.
const pendingDrafts = new Map<string, PendingDraft>();

function pruneExpiredDrafts() {
  const cutoff = Date.now() - PENDING_DRAFT_TTL_MS;
  for (const [id, draft] of pendingDrafts) {
    if (draft.createdAt < cutoff) pendingDrafts.delete(id);
  }
}

async function telegramApi(method: string, body: unknown) {
  await fetch(`${TELEGRAM_API}/bot${config.telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendTelegramMessage(chatId: number, text: string) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
    chunks.push(text.slice(i, i + MAX_MESSAGE_LENGTH));
  }
  for (const chunk of chunks) {
    await telegramApi("sendMessage", { chat_id: chatId, text: chunk });
  }
}

async function sendTypingAction(chatId: number) {
  await telegramApi("sendChatAction", { chat_id: chatId, action: "typing" });
}

async function sendAuditInvoice(chatId: number, payloadId: string) {
  await telegramApi("sendInvoice", {
    chat_id: chatId,
    title: "Second Pass Audit",
    description: "Accuracy audit for your draft — checks every verifiable claim before you publish it.",
    payload: payloadId,
    currency: "XTR",
    prices: [{ label: "Audit", amount: AUDIT_PRICE_STARS }],
    provider_token: "",
  });
}

async function runAudit(chatId: number, draftText: string) {
  try {
    await sendTypingAction(chatId);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SECOND_PASS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: draftText }],
    });

    const auditText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    await sendTelegramMessage(chatId, auditText || "Audit produced no output — try again.");
  } catch (err) {
    await sendTelegramMessage(
      chatId,
      `Audit failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function handlePreCheckoutQuery(query: TelegramPreCheckoutQuery) {
  const stillPending = pendingDrafts.has(query.invoice_payload);
  await telegramApi(
    "answerPreCheckoutQuery",
    stillPending
      ? { pre_checkout_query_id: query.id, ok: true }
      : {
          pre_checkout_query_id: query.id,
          ok: false,
          error_message: "This audit request expired — please send your draft again.",
        }
  );
}

async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id;

  if (message.successful_payment) {
    const draft = pendingDrafts.get(message.successful_payment.invoice_payload);
    pendingDrafts.delete(message.successful_payment.invoice_payload);
    if (!draft) {
      await sendTelegramMessage(chatId, "Payment received, but I lost track of your draft — please resend it.");
      return;
    }
    await runAudit(chatId, draft.text);
    return;
  }

  const text = message.text?.trim();

  if (!text || text === "/start" || text === "/help") {
    await sendTelegramMessage(chatId, WELCOME_TEXT);
    return;
  }

  pruneExpiredDrafts();
  const id = randomUUID();
  pendingDrafts.set(id, { chatId, text, createdAt: Date.now() });
  await sendAuditInvoice(chatId, id);
}

async function handleUpdate(update: TelegramUpdate) {
  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(update.pre_checkout_query);
    return;
  }
  if (update.message) {
    await handleMessage(update.message);
  }
}

telegramRouter.post("/telegram/second-pass", (req, res) => {
  const secretHeader = req.header("x-telegram-bot-api-secret-token") ?? "";
  if (!config.telegramWebhookSecret || secretHeader !== config.telegramWebhookSecret) {
    res.status(401).json({ error: "Invalid or missing webhook secret" });
    return;
  }

  // Ack immediately — Telegram expects a fast response and will retry if we
  // don't answer promptly. The actual work (a Claude call, or a Stars
  // invoice round-trip) can take longer than that, so it happens after
  // responding rather than blocking on it.
  res.status(200).json({ ok: true });

  void handleUpdate(req.body as TelegramUpdate);
});
