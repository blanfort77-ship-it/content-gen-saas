# content-gen-saas

An AI content-generation tool for blog posts, social captions, and marketing
copy, powered by Claude — with two layers:

- **[`packages/core`](packages/core)** — MIT-licensed, open source. A library
  and CLI anyone can self-host for free with their own Anthropic API key.
- **[`packages/api`](packages/api)** — the hosted version of this repo's
  owner's choosing to run: API-key auth, per-plan usage quotas, and Stripe
  subscription billing (Starter $9/mo, Pro $29/mo) on top of the core package.

## Quick start

```bash
npm install
npm test                # runs packages/core's test suite
npm run dev:api          # runs the hosted API locally (see packages/api/README.md for setup)
```

See [`packages/core/README.md`](packages/core/README.md) to use the
generation library/CLI directly, or
[`packages/api/README.md`](packages/api/README.md) for local dev and Render
deployment instructions for the paid hosted API.
