# @content-gen/core

Open-source library and CLI for generating blog posts, social captions, and
marketing copy with Claude (Anthropic). MIT licensed — self-host it for free
with your own Anthropic API key, no account or billing required.

Looking for the hosted, pay-as-you-go version instead? See `packages/api` in
this repo, or the deployed hosted API.

## Install

```bash
npm install @content-gen/core
```

Requires `ANTHROPIC_API_KEY` in the environment. Get one at
https://console.anthropic.com/.

## Library usage

```ts
import { generateContent } from "@content-gen/core";

const result = await generateContent({
  brief: "a new espresso blend called Midnight Roast",
  contentType: "social", // "blog" | "social" | "marketing"
  tone: "playful",       // optional
  length: 60,             // optional, approximate word count
});

console.log(result.content);
```

`generateContent` optionally accepts a pre-configured `Anthropic` client as a
second argument, useful for testing or custom client options.

## CLI usage

```bash
npx content-gen generate --brief "a new espresso blend" --type social --tone playful
```

## Development

```bash
npm install
npm run build
npm test
```
