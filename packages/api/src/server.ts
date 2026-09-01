import express from "express";
import { config } from "./config.js";
import { webhookRouter } from "./routes/webhook.js";
import { billingRouter } from "./routes/billing.js";
import { generateRouter } from "./routes/generate.js";
import { siteRouter } from "./routes/site.js";
import { poeRouter } from "./routes/poe.js";

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

app.listen(config.port, () => {
  console.log(`content-gen API listening on port ${config.port}`);
});
