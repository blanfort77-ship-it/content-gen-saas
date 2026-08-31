import { Router } from "express";

export const siteRouter = Router();

const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — content-gen</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.3rem; margin-top: 2rem; }
  .plan { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 12px 0; }
  .price { font-size: 1.5rem; font-weight: bold; }
  a { color: #5433ff; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #666; }
</style>
</head>
<body>
${body}
<footer>
  <p>content-gen is a product of United Surface Coatings, LLC. Contact: <a href="mailto:blanfort77@gmail.com">blanfort77@gmail.com</a></p>
  <p><a href="/">Home</a> · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/support">Support</a></p>
</footer>
</body>
</html>`;

siteRouter.get("/", (_req, res) => {
  res.type("html").send(
    page(
      "Home",
      `
    <h1>content-gen</h1>
    <p>An API that generates blog posts, social media captions, and marketing copy using AI. Subscribe monthly for API access with a usage quota.</p>

    <h2>Plans</h2>
    <div class="plan">
      <div class="price">Starter — $9/month</div>
      <p>100 generations per month</p>
    </div>
    <div class="plan">
      <div class="price">Pro — $29/month</div>
      <p>1,000 generations per month</p>
    </div>

    <h2>Getting started</h2>
    <p>Sign up via the API to receive an API key and start generating content. See <a href="mailto:blanfort77@gmail.com">contact support</a> for onboarding help.</p>
  `
    )
  );
});

siteRouter.get("/privacy", (_req, res) => {
  res.type("html").send(
    page(
      "Privacy Policy",
      `
    <h1>Privacy Policy</h1>
    <p>Last updated: ${new Date().toISOString().slice(0, 10)}</p>

    <h2>Information we collect</h2>
    <p>We collect the email address you provide at signup, and payment information handled directly by our payment processor, Stripe (we never see or store your card details). We also store the content-generation requests you submit via the API, solely to process and return the response.</p>

    <h2>How we use it</h2>
    <p>Your email and subscription status are used to authenticate API access and manage billing. We do not sell or share your data with third parties except as required to operate the service (e.g., Stripe for billing, Anthropic for AI generation).</p>

    <h2>Data retention</h2>
    <p>Account and subscription data is retained for as long as your account is active. You may request deletion by contacting us below.</p>

    <h2>Contact</h2>
    <p>Questions about this policy: <a href="mailto:blanfort77@gmail.com">blanfort77@gmail.com</a></p>
  `
    )
  );
});

siteRouter.get("/terms", (_req, res) => {
  res.type("html").send(
    page(
      "Terms of Service",
      `
    <h1>Terms of Service</h1>
    <p>Last updated: ${new Date().toISOString().slice(0, 10)}</p>

    <h2>Service</h2>
    <p>content-gen provides an API for generating text content (blog posts, social media captions, marketing copy) using AI. Access is provided on a monthly subscription basis (Starter or Pro plan), each with a fixed monthly generation quota.</p>

    <h2>Billing</h2>
    <p>Subscriptions are billed monthly in advance via Stripe and renew automatically until cancelled. You can cancel at any time through the billing portal; access continues until the end of the current billing period.</p>

    <h2>Acceptable use</h2>
    <p>You are responsible for the content you generate and how you use it. Do not use the service to generate illegal, infringing, or abusive content.</p>

    <h2>Availability</h2>
    <p>The service is provided "as is" without warranty of any kind. We do not guarantee uninterrupted availability.</p>

    <h2>Contact</h2>
    <p>Questions about these terms: <a href="mailto:blanfort77@gmail.com">blanfort77@gmail.com</a></p>
  `
    )
  );
});

siteRouter.get("/support", (_req, res) => {
  res.type("html").send(
    page(
      "Support",
      `
    <h1>Support</h1>
    <p>For questions about your subscription, billing, or the API, contact:</p>
    <p><a href="mailto:blanfort77@gmail.com">blanfort77@gmail.com</a></p>
    <p>We aim to respond within 1–2 business days.</p>
  `
    )
  );
});
