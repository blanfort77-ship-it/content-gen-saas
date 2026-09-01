import "dotenv/config";

function required(name: string): string {
  // Trim defensively: env var UIs (including Render's) can pick up a
  // trailing newline/space from copy-paste, which passes through fine as an
  // env var but breaks Node's raw HTTP header validation downstream.
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  stripeSecretKey: required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  databaseUrl: required("DATABASE_URL"),
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:3000",
  // Optional, not required: the Poe bridge route rejects requests with 401
  // if this isn't set, rather than crashing the whole API on boot.
  poeAccessKey: process.env.POE_ACCESS_KEY?.trim(),
  plans: {
    STARTER: {
      priceId: required("STRIPE_PRICE_STARTER"),
      monthlyQuota: 100,
    },
    PRO: {
      priceId: required("STRIPE_PRICE_PRO"),
      monthlyQuota: 1000,
    },
  },
} as const;

export type PlanName = keyof typeof config.plans;
