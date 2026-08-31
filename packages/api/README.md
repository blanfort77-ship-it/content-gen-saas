# @content-gen/api

The hosted, subscription-billed layer around `@content-gen/core`. Handles
API-key auth, per-plan usage quotas, and Stripe subscription billing.

## Local development

1. Start Postgres:
   ```bash
   docker compose -f packages/api/docker-compose.yml up -d
   ```
2. Copy the env template and fill in your keys:
   ```bash
   cp packages/api/.env.example packages/api/.env
   ```
   You'll need:
   - `ANTHROPIC_API_KEY` — https://console.anthropic.com/
   - Stripe **test-mode** secret key — https://dashboard.stripe.com/test/apikeys
   - Two Stripe test Products/Prices (e.g. "Starter" $9/mo, "Pro" $29/mo) — https://dashboard.stripe.com/test/products — put their price IDs in `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO`
   - `STRIPE_WEBHOOK_SECRET` — see below
3. From the repo root: `npm install`
4. Run the initial migration: `npm run prisma:migrate --workspace=@content-gen/api`
5. Forward Stripe webhooks to your local server (requires the [Stripe CLI](https://stripe.com/docs/stripe-cli)):
   ```bash
   stripe listen --forward-to localhost:3000/v1/stripe/webhook
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.
6. Start the API: `npm run dev --workspace=@content-gen/api`

### Try it end-to-end

```bash
# 1. Start a subscription checkout
curl -X POST localhost:3000/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","plan":"STARTER"}'
# -> open the returned checkoutUrl, pay with Stripe test card 4242 4242 4242 4242

# 2. After paying, Stripe redirects to /v1/onboard?session_id=... which returns your API key.
#    (Or poll it directly with the session_id from the redirect.)

# 3. Generate content
curl -X POST localhost:3000/v1/generate \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"brief":"a new espresso blend","contentType":"social","tone":"playful"}'
```

Calling `/v1/generate` past your plan's monthly quota returns `429`.

## Deploying to Render

1. Push this repo to a git remote (GitHub/GitLab) — Render deploys from git.
2. In the Render dashboard: **New > Blueprint**, point it at the repo. It reads
   `render.yaml` at the repo root and provisions the web service + a managed
   Postgres database automatically.
3. Fill in the env vars Render prompts for (marked `sync: false` in
   `render.yaml`): `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, and
   `PUBLIC_URL` (your Render service's URL, e.g. `https://content-gen-api.onrender.com`).
4. In Stripe, add a **live-mode** webhook endpoint pointing at
   `https://<your-render-url>/v1/stripe/webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET` on Render.
5. Switch `STRIPE_SECRET_KEY` and your price IDs to live mode once you're
   ready to charge real customers.

The Docker image runs `prisma migrate deploy` on boot, so schema migrations
apply automatically on each deploy.
