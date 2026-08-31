import express from "express";
import { config } from "./config.js";
import { webhookRouter } from "./routes/webhook.js";
import { billingRouter } from "./routes/billing.js";
import { generateRouter } from "./routes/generate.js";

const app = express();

// Must be mounted before express.json() — Stripe webhook signature
// verification needs the raw request body.
app.use(webhookRouter);

app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

// TEMPORARY diagnostic — never returns the key itself, only structural info
// (length + positions/codes of non-printable-ASCII characters), to debug a
// persistent ERR_INVALID_CHAR on the Stripe Authorization header.
app.get("/v1/debug/stripe-key-check", (_req, res) => {
  const key = config.stripeSecretKey;
  const suspicious = [...key]
    .map((ch, i) => ({ i, code: ch.charCodeAt(0) }))
    .filter((c) => c.code < 33 || c.code > 126);
  res.json({ length: key.length, suspiciousChars: suspicious });
});
app.use(billingRouter);
app.use(generateRouter);

app.listen(config.port, () => {
  console.log(`content-gen API listening on port ${config.port}`);
});
