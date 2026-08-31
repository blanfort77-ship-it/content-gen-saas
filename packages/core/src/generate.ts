import Anthropic from "@anthropic-ai/sdk";
import type { ContentType, GenerateContentInput, GenerateContentResult } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";

const CONTENT_TYPE_INSTRUCTIONS: Record<ContentType, string> = {
  blog: "Write a blog post with a clear headline, short paragraphs, and a natural conclusion.",
  social: "Write a short social media caption. Keep it punchy, no more than a few sentences, and include relevant hashtags if appropriate.",
  marketing: "Write persuasive marketing copy focused on a clear value proposition and a call to action.",
};

function buildPrompt(input: GenerateContentInput): string {
  const tone = input.tone ?? "professional";
  const lengthInstruction = input.length
    ? `Aim for approximately ${input.length} words.`
    : "";

  return [
    CONTENT_TYPE_INSTRUCTIONS[input.contentType],
    `Tone: ${tone}.`,
    lengthInstruction,
    `Brief: ${input.brief}`,
    "Return only the generated content, with no preamble or explanation.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generates content by calling the Anthropic API. Requires ANTHROPIC_API_KEY
 * in the environment, or pass an Anthropic client via `client`.
 */
export async function generateContent(
  input: GenerateContentInput,
  client: Anthropic = new Anthropic()
): Promise<GenerateContentResult> {
  const model = input.model ?? DEFAULT_MODEL;

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  const content = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return { content, contentType: input.contentType, model };
}
