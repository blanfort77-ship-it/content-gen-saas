#!/usr/bin/env node
import { Command } from "commander";
import { generateContent } from "../src/generate.js";
import type { ContentType } from "../src/types.js";

const program = new Command();

program
  .name("content-gen")
  .description("Generate blog, social, or marketing copy with Claude.");

program
  .command("generate")
  .requiredOption("-b, --brief <text>", "what the content should be about")
  .requiredOption("-t, --type <type>", "blog | social | marketing")
  .option("--tone <tone>", "e.g. playful, professional, urgent")
  .option("--length <words>", "approximate target length in words", parseInt)
  .action(async (opts) => {
    const contentType = opts.type as ContentType;
    if (!["blog", "social", "marketing"].includes(contentType)) {
      console.error(`Invalid --type "${opts.type}". Must be blog, social, or marketing.`);
      process.exitCode = 1;
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Missing ANTHROPIC_API_KEY environment variable.");
      process.exitCode = 1;
      return;
    }

    try {
      const result = await generateContent({
        brief: opts.brief,
        contentType,
        tone: opts.tone,
        length: opts.length,
      });
      console.log(result.content);
    } catch (err) {
      console.error("Generation failed:", err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
