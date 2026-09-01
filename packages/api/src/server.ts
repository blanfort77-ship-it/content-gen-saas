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

// Defense in depth, on top of the .catch() on every fire-and-forget handler:
// one uncaught rejection anywhere must never take down paid content-gen
// traffic along with whichever bot triggered it. Log and keep running.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (process kept alive):", reason);
});

const app = express();

// Must be mounted before express.json() — Stripe webhook signature
// verification needs the raw request body.
app.use(webhookRouter);

app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
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
