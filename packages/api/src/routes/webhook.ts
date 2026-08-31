import { Router, raw } from "express";
import type Stripe from "stripe";
import { stripe } from "../stripe/client.js";
import { db } from "../db/client.js";
import { config, type PlanName } from "../config.js";
import { generateApiKey } from "../apiKey.js";

export const webhookRouter = Router();

function planFromPriceId(priceId: string): PlanName {
  const entry = (Object.entries(config.plans) as [PlanName, { priceId: string }][]).find(
    ([, plan]) => plan.priceId === priceId
  );
  if (!entry) throw new Error(`Unrecognized Stripe price id: ${priceId}`);
  return entry[0];
}

function mapStripeStatus(status: Stripe.Subscription.Status): "ACTIVE" | "PAST_DUE" | "CANCELED" {
  if (status === "active" || status === "trialing") return "ACTIVE";
  if (status === "past_due" || status === "unpaid") return "PAST_DUE";
  return "CANCELED";
}

async function upsertSubscription(sub: Stripe.Subscription, userId: string) {
  const priceId = sub.items.data[0]?.price.id;
  await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      userId,
      stripeSubscriptionId: sub.id,
      plan: planFromPriceId(priceId!),
      status: mapStripeStatus(sub.status),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
    update: {
      plan: planFromPriceId(priceId!),
      status: mapStripeStatus(sub.status),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
  });
}

// Mounted with express.raw() (see server.ts) — Stripe signature verification
// requires the exact raw request body, not the JSON-parsed one.
webhookRouter.post("/v1/stripe/webhook", raw({ type: "application/json" }), async (req, res) => {
  let event: Stripe.Event;
  try {
    const signature = req.header("stripe-signature") ?? "";
    event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err instanceof Error ? err.message : err}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        // customer_email is only auto-populated for guest checkouts; since we
        // create the Checkout Session against an existing customer, the email
        // lives on customer_details instead.
        const email = session.customer_details?.email;
        if (!customerId || !subscriptionId || !email) break;

        const user = await db.user.upsert({
          where: { stripeCustomerId: customerId },
          create: { email, stripeCustomerId: customerId },
          update: {},
        });

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(subscription, user.id);
        await db.apiKey.create({ data: { userId: user.id, key: generateApiKey() } });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const user = await db.user.findUnique({ where: { stripeCustomerId: customerId } });
        if (!user) break;
        await upsertSubscription(subscription, user.id);
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Webhook handling failed.", detail: err instanceof Error ? err.message : String(err) });
  }
});
