import { Router } from "express";
import { stripe } from "../stripe/client.js";
import { db } from "../db/client.js";
import { config, type PlanName } from "../config.js";

export const billingRouter = Router();

const PLAN_NAMES = Object.keys(config.plans) as PlanName[];

// Starts the subscription flow: creates a Stripe customer + hosted Checkout
// Session. The customer pays on Stripe's page; our webhook (see webhook.ts)
// provisions the account and API key once payment succeeds.
billingRouter.post("/v1/signup", async (req, res) => {
  const { email, plan } = req.body ?? {};

  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid 'email' is required." });
    return;
  }
  if (!PLAN_NAMES.includes(plan)) {
    res.status(400).json({ error: `'plan' must be one of: ${PLAN_NAMES.join(", ")}` });
    return;
  }

  try {
    const customer = await stripe.customers.create({ email });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: config.plans[plan as PlanName].priceId, quantity: 1 }],
      success_url: `${config.publicUrl}/v1/onboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.publicUrl}/v1/signup/cancelled`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Signup failed.", detail: err instanceof Error ? err.message : String(err) });
  }
});

// Success-redirect landing: looks up the account the webhook provisioned and
// returns the API key once. If the webhook hasn't landed yet (rare race),
// asks the client to retry briefly.
billingRouter.get("/v1/onboard", async (req, res) => {
  const sessionId = req.query.session_id;
  if (typeof sessionId !== "string") {
    res.status(400).json({ error: "Missing session_id." });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!customerId) {
      res.status(400).json({ error: "Checkout session has no associated customer." });
      return;
    }

    const user = await db.user.findUnique({
      where: { stripeCustomerId: customerId },
      include: { apiKeys: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!user || user.apiKeys.length === 0) {
      res.status(202).json({ status: "provisioning", message: "Still setting up your account, retry in a few seconds." });
      return;
    }

    res.json({ apiKey: user.apiKeys[0].key });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Onboarding lookup failed.", detail: err instanceof Error ? err.message : String(err) });
  }
});

// Returns a Stripe-hosted billing portal link for the authenticated customer
// to manage or cancel their subscription.
billingRouter.get("/v1/portal", async (req, res) => {
  const customerId = req.query.customerId;
  if (typeof customerId !== "string") {
    res.status(400).json({ error: "Missing customerId." });
    return;
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: config.publicUrl,
    });

    res.json({ portalUrl: portalSession.url });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Portal session failed.", detail: err instanceof Error ? err.message : String(err) });
  }
});
