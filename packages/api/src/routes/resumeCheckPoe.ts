import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { RESUME_CHECK_SYSTEM_PROMPT } from "../resumeCheckPrompt.js";

export const resumeCheckPoeRouter = Router();

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

resumeCheckPoeRouter.post("/poe/resume-check", async (req, res) => {
  const authHeader = req.header("authorization") ?? "";
  if (!config.resumeCheckPoeAccessKey || authHeader !== `Bearer ${config.resumeCheckPoeAccessKey}`) {
    res.status(401).json({ error: "Invalid or missing access key" });
    return;
  }

  const body = req.body as PoeRequestBody;

  if (body.type === "settings") {
    res.status(200).json({});
    return;
  }

  if (body.type !== "query") {
    res.status(200).json({});
    return;
  }

  const messages = body.query ?? [];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const resumeText = lastUserMessage?.content?.trim();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  sendEvent(res, "meta", { content_type: "text/markdown" });

  if (!resumeText) {
    sendEvent(res, "text", {
      text: "Paste a resume, cover letter, or a single bullet point you want checked.",
    });
    sendEvent(res, "done", {});
    res.end();
    return;
  }

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: RESUME_CHECK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: resumeText }],
    });

    stream.on("text", (textDelta) => {
      sendEvent(res, "text", { text: textDelta });
    });

    await stream.finalMessage();
    sendEvent(res, "done", {});
    res.end();
  } catch (err) {
    sendEvent(res, "error", {
      text: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
      allow_retry: true,
    });
    res.end();
  }
});
