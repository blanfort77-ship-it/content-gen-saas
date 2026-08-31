import { Router } from "express";
import { generateContent } from "@content-gen/core";
import type { ContentType } from "@content-gen/core";
import { apiKeyAuth } from "../middleware/apiKeyAuth.js";
import { usageLimit } from "../middleware/usageLimit.js";

const CONTENT_TYPES: ContentType[] = ["blog", "social", "marketing"];

export const generateRouter = Router();

generateRouter.post("/v1/generate", apiKeyAuth, usageLimit, async (req, res) => {
  const { brief, contentType, tone, length } = req.body ?? {};

  if (typeof brief !== "string" || !brief.trim()) {
    res.status(400).json({ error: "'brief' is required." });
    return;
  }
  if (!CONTENT_TYPES.includes(contentType)) {
    res.status(400).json({ error: `'contentType' must be one of: ${CONTENT_TYPES.join(", ")}` });
    return;
  }

  try {
    const result = await generateContent({ brief, contentType, tone, length });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "Generation failed.", detail: err instanceof Error ? err.message : String(err) });
  }
});
