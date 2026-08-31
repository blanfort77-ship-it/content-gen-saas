import { describe, it, expect, vi } from "vitest";
import { generateContent } from "../src/generate.js";
import type Anthropic from "@anthropic-ai/sdk";

function fakeClient(text: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text }],
      }),
    },
  } as unknown as Anthropic;
}

describe("generateContent", () => {
  it("returns trimmed text from the Anthropic response", async () => {
    const client = fakeClient("  Hello world  ");
    const result = await generateContent(
      { brief: "a coffee shop", contentType: "social" },
      client
    );
    expect(result.content).toBe("Hello world");
    expect(result.contentType).toBe("social");
  });

  it("passes the requested model through to the API call", async () => {
    const client = fakeClient("copy");
    await generateContent(
      { brief: "a coffee shop", contentType: "blog", model: "claude-test-model" },
      client
    );
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-test-model" })
    );
  });

  it("includes tone and brief in the prompt sent to the API", async () => {
    const client = fakeClient("copy");
    await generateContent(
      { brief: "a bakery launch", contentType: "marketing", tone: "urgent" },
      client
    );
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const prompt = call.messages[0].content as string;
    expect(prompt).toContain("urgent");
    expect(prompt).toContain("a bakery launch");
  });
});
