import { randomUUID } from "node:crypto";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { RESUME_CHECK_SYSTEM_PROMPT } from "../resumeCheckPrompt.js";

export const resumeCheckTelegramRouter = Router();

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4000; // Telegram's real limit is 4096; leave headroom.
const CHECK_PRICE_STARS = 10; // Cheaper than Second Pass - shorter input, faster decision to buy.
const PENDING_DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes.

const WELCOME_TEXT =
  "Send me a resume, cover letter, or a single bullet point and I'll flag what reads as generic AI output " +
  "and what an interviewer could catch you unable to defend. " +
  `Each check costs ${CHECK_PRICE_STARS} Telegram Stars. ` +
  "I don't rewrite your content for you - I ask the specific question an interviewer would ask, so you fill in the real answer yourself.";

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

const pendingDrafts = new Map<string, PendingDraft>();

function pruneExpiredDrafts() {
  const cutoff = Date.now() - PENDING_DRAFT_TTL_MS;
  for (const [id, draft] of pendingDrafts) {
    if (draft.createdAt < cutoff) pendingDrafts.delete(id);
  }
}

async function telegramApi(method: string, body: unknown) {
  const res = await fetch(`${TELEGRAM_API}/bot${config.resumeCheckTelegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Telegram API ${method} failed (${res.status}): ${errorBody}`);
  }
  return res;
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

async function sendCheckInvoice(chatId: number, payloadId: string) {
  await telegramApi("sendInvoice", {
    chat_id: chatId,
    title: "Real Resume Check",
    description: "Flags generic AI phrasing and unverifiable claims in your resume or cover letter.",
    payload: payloadId,
    currency: "XTR",
    prices: [{ label: "Check", amount: CHECK_PRICE_STARS }],
    provider_token: "",
  });
}

async function runCheck(chatId: number, resumeText: string) {
  try {
    await sendTypingAction(chatId);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: RESUME_CHECK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: resumeText }],
    });

    const checkText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    await sendTelegramMessage(chatId, checkText || "Check produced no output - try again.");
  } catch (err) {
    await sendTelegramMessage(
      chatId,
      `Check failed: ${err instanceof Error ? err.message : String(err)}`
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
          error_message: "This check request expired - please send your text again.",
        }
  );
}

async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id;

  if (message.successful_payment) {
    const draft = pendingDrafts.get(message.successful_payment.invoice_payload);
    pendingDrafts.delete(message.successful_payment.invoice_payload);
    if (!draft) {
      await sendTelegramMessage(chatId, "Payment received, but I lost track of your text - please resend it.");
      return;
    }
    await runCheck(chatId, draft.text);
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
  await sendCheckInvoice(chatId, id);
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

resumeCheckTelegramRouter.post("/telegram/resume-check", (req, res) => {
  const secretHeader = req.header("x-telegram-bot-api-secret-token") ?? "";
  if (!config.resumeCheckTelegramWebhookSecret || secretHeader !== config.resumeCheckTelegramWebhookSecret) {
    res.status(401).json({ error: "Invalid or missing webhook secret" });
    return;
  }

  res.status(200).json({ ok: true });

  void handleUpdate(req.body as TelegramUpdate);
});
