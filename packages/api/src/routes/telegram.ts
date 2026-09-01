import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { SECOND_PASS_SYSTEM_PROMPT } from "../secondPassPrompt.js";

export const telegramRouter = Router();

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4000; // Telegram's real limit is 4096; leave headroom.

const WELCOME_TEXT =
  "Send me a draft — an article, code, or report — and I'll audit it for accuracy before you publish it. " +
  "I inventory every verifiable claim, check internal consistency and code logic by reasoning through it, " +
  "and flag anything that would need external verification instead of guessing. " +
  "No live web access or code execution in this version — I'll say so explicitly when I can't check something here.";

interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

async function sendTelegramMessage(chatId: number, text: string) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
    chunks.push(text.slice(i, i + MAX_MESSAGE_LENGTH));
  }

  for (const chunk of chunks) {
    await fetch(`${TELEGRAM_API}/bot${config.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
  }
}

async function sendTypingAction(chatId: number) {
  await fetch(`${TELEGRAM_API}/bot${config.telegramBotToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

async function handleUpdate(update: TelegramUpdate) {
  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  if (!chatId) return;

  if (!text || text === "/start" || text === "/help") {
    await sendTelegramMessage(chatId, WELCOME_TEXT);
    return;
  }

  try {
    await sendTypingAction(chatId);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SECOND_PASS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
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

telegramRouter.post("/telegram/second-pass", (req, res) => {
  const secretHeader = req.header("x-telegram-bot-api-secret-token") ?? "";
  if (!config.telegramWebhookSecret || secretHeader !== config.telegramWebhookSecret) {
    res.status(401).json({ error: "Invalid or missing webhook secret" });
    return;
  }

  // Ack immediately — Telegram expects a fast response and will retry if we
  // don't answer promptly. The actual audit (a Claude call) can take longer
  // than that, so we do it after responding rather than blocking on it.
  res.status(200).json({ ok: true });

  void handleUpdate(req.body as TelegramUpdate);
});
