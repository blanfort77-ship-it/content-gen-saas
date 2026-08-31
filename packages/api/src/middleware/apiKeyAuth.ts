import type { NextFunction, Request, Response } from "express";
import type { Subscription, User } from "@prisma/client";
import { db } from "../db/client.js";

export interface AuthedRequest extends Request {
  user?: User;
  subscription?: Subscription;
}

export async function apiKeyAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!key) {
    res.status(401).json({ error: "Missing API key. Pass it as 'Authorization: Bearer <key>'." });
    return;
  }

  const apiKey = await db.apiKey.findUnique({
    where: { key },
    include: { user: { include: { subscriptions: true } } },
  });

  if (!apiKey || apiKey.revoked) {
    res.status(401).json({ error: "Invalid API key." });
    return;
  }

  const activeSubscription = apiKey.user.subscriptions.find((s) => s.status === "ACTIVE");
  if (!activeSubscription) {
    res.status(402).json({ error: "No active subscription for this account." });
    return;
  }

  req.user = apiKey.user;
  req.subscription = activeSubscription;
  next();
}
