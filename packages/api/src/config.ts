import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
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
