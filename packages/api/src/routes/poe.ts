import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { SECOND_PASS_SYSTEM_PROMPT } from "../secondPassPrompt.js";

export const poeRouter = Router();

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

interface PoeQueryMessage {
  role: string;
  content: string;
}

interface PoeRequestBody {
  type?: string;
  query?: PoeQueryMessage[];
}

function sendEvent(res: import("express").Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

poeRouter.post("/poe/second-pass", async (req, res) => {
  const authHeader = req.header("authorization") ?? "";
  if (!config.poeAccessKey || authHeader !== `Bearer ${config.poeAccessKey}`) {
    res.status(401).json({ error: "Invalid or missing access key" });
    return;
  }

  const body = req.body as PoeRequestBody;

  // Poe's "settings" handshake expects a plain JSON response, not SSE.
  if (body.type === "settings") {
    res.status(200).json({});
    return;
  }

  // report_feedback / report_reaction / report_error / any future type this
  // bot doesn't act on — acknowledge and move on rather than error.
  if (body.type !== "query") {
    res.status(200).json({});
    return;
  }

  const messages = body.query ?? [];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const draftText = lastUserMessage?.content?.trim();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  sendEvent(res, "meta", { content_type: "text/markdown" });

  if (!draftText) {
    sendEvent(res, "text", {
      text: "Paste the draft you want audited — the article, code, or report text itself — as your message.",
    });
    sendEvent(res, "done", {});
    res.end();
    return;
  }

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SECOND_PASS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: draftText }],
    });

    stream.on("text", (textDelta) => {
      sendEvent(res, "text", { text: textDelta });
    });

    await stream.finalMessage();
    sendEvent(res, "done", {});
    res.end();
  } catch (err) {
    sendEvent(res, "error", {
      text: `Audit failed: ${err instanceof Error ? err.message : String(err)}`,
      allow_retry: true,
    });
    res.end();
  }
});
