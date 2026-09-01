import express from "express";
import { config } from "./config.js";
import { webhookRouter } from "./routes/webhook.js";
import { billingRouter } from "./routes/billing.js";
import { generateRouter } from "./routes/generate.js";
import { siteRouter } from "./routes/site.js";
import { poeRouter } from "./routes/poe.js";
import { telegramRouter } from "./routes/telegram.js";
import { resumeCheckPoeRouter } from "./routes/resumeCheckPoe.js";
import { resumeCheckTelegramRouter } from "./routes/resumeCheckTelegram.js";

const app = express();

// Must be mounted before express.json() — Stripe webhook signature
// verification needs the raw request body.
app.use(webhookRouter);

app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
// TEMPORARY diagnostic — reports whether env vars are loaded and their
// length only, never the value. Same technique used earlier to root-cause
// a Render secret-corruption bug; remove once this is resolved.
app.get("/debug/env-check", (_req, res) => {
  res.json({
    resumeCheckTelegramWebhookSecret: {
      set: Boolean(config.resumeCheckTelegramWebhookSecret),
      length: config.resumeCheckTelegramWebhookSecret?.length ?? 0,
      firstChars: config.resumeCheckTelegramWebhookSecret?.slice(0, 4) ?? null,
    },
    resumeCheckTelegramBotToken: {
      set: Boolean(config.resumeCheckTelegramBotToken),
      length: config.resumeCheckTelegramBotToken?.length ?? 0,
    },
    resumeCheckPoeAccessKey: {
      set: Boolean(config.resumeCheckPoeAccessKey),
      length: config.resumeCheckPoeAccessKey?.length ?? 0,
    },
  });
});
app.use(siteRouter);
app.use(billingRouter);
app.use(generateRouter);
app.use(poeRouter);
app.use(telegramRouter);
app.use(resumeCheckPoeRouter);
app.use(resumeCheckTelegramRouter);

app.listen(config.port, () => {
  console.log(`content-gen API listening on port ${config.port}`);
});
