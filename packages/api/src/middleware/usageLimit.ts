import type { NextFunction, Response } from "express";
import { db } from "../db/client.js";
import { config } from "../config.js";
import type { AuthedRequest } from "./apiKeyAuth.js";

// currentPeriodEnd changes on every renewal, so it doubles as a stable key
// for "this billing cycle" without needing to store a separate period-start field.
export async function usageLimit(req: AuthedRequest, res: Response, next: NextFunction) {
  const subscription = req.subscription!;
  const quota = config.plans[subscription.plan].monthlyQuota;
  const period = subscription.currentPeriodEnd;

  const counter = await db.usageCounter.upsert({
    where: { subscriptionId_period: { subscriptionId: subscription.id, period } },
    create: { subscriptionId: subscription.id, period, count: 0 },
    update: {},
  });

  if (counter.count >= quota) {
    res.status(429).json({
      error: `Monthly generation quota (${quota}) reached for the ${subscription.plan} plan.`,
    });
    return;
  }

  await db.usageCounter.update({
    where: { id: counter.id },
    data: { count: { increment: 1 } },
  });

  next();
}
