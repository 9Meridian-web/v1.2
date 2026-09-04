# AI Receptionist Backend — Production Upgrade

## What was improved

- Production-safe CORS allowlist.
- Helmet security headers and smaller request-body limits.
- Request IDs for tracing.
- Health/live and readiness endpoints.
- Login/register and AI/public-agent rate limiting.
- Sanitized production error responses.
- Google OAuth state is now signed, short-lived, and bound to the authenticated user/client.
- Google refresh-token encryption support (AES-256-GCM) with legacy fallback during migration.
- Removed sensitive Google/token/event debug logging.
- Google Calendar/Sheets configuration remains client-scoped.
- Agent routes are authenticated and client-owned.
- Agent publishing now creates/uses a public slug.
- Onboarding status endpoint added.
- Provider-agnostic payment confirmation webhook handoff added.
- Supabase migration adds order/client lifecycle and agent publishing fields.

## Before deployment

1. Run `supabase/migrations/20260812_production_saas.sql` in Supabase.
2. Copy `.env.example` to `.env` and fill production values.
3. If existing Google connections contain legacy plaintext refresh tokens, run `npm run migrate:encrypt-google-tokens` once after the migration and before exposing the service publicly.
4. **Do not commit `.env` or any service-role/API/OAuth secrets.**
5. Use a fresh production `JWT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET`, `INTERNAL_WEBHOOK_SECRET`, and `GOOGLE_TOKEN_ENCRYPTION_KEY`.
6. Set a separate random `CRON_SECRET` of at least 16 characters. Vercel sends it as a Bearer token when invoking the payment-queue cron endpoint.
7. Configure Google's production OAuth redirect URI to the HTTPS API URL.
8. Configure Google OAuth consent/verification for the scopes actually used.
9. Point `CORS_ORIGINS` only at trusted frontend origins.
10. Configure the payment provider webhook to call:
   `POST /api/internal/payments/confirmed`
   with `X-Internal-Webhook-Secret` and a provider-unique `payment_id`.
11. After payment confirmation, the response contains `client_id` and a short-lived `setup_token`. The website should use the setup token to call `POST /api/auth/register` and create the client owner account. Do not expose the internal webhook secret to the browser.
12. The authenticated onboarding dashboard can call `GET /api/onboarding/status`.
13. Create the agent with `POST /api/agents`, then publish it with `POST /api/agents/:id/publish`.
14. Published agents receive a public URL based on `PUBLIC_AGENT_BASE_URL`.

## Vercel deployment

The repository contains `api/index.ts`, a serverless entry point which exports the Express application without calling `listen()`, plus `vercel.json` routing and the payment queue cron job.

1. In Vercel, set the project Root Directory to this folder (`ai-receptionist-backend`) if the Git repository includes its parent folder.
2. Add every value in `.env.example` under **Settings → Environment Variables** for the Production environment. Do not upload `.env`.
3. Deploy on a Vercel Pro team. The configured queue job runs every minute; Hobby cron jobs run only once a day and are not suitable for payment processing.
4. Vercel invokes `GET /api/internal/process-webhooks` every minute. It is internally rewritten to the protected cron function, which verifies `Authorization: Bearer $CRON_SECRET` before claiming queued Razorpay events.
5. Add the production domain in **Settings → Domains**, then update `FRONTEND_URL`, `CORS_ORIGINS`, `PUBLIC_AGENT_BASE_URL`, and `GOOGLE_REDIRECT_URI` to that domain.

## Important architecture note

This backend does **not** pretend to implement a payment provider or automatic Dify app cloning without provider credentials/configuration. Payment verification is intentionally isolated behind the internal webhook endpoint, and Dify provisioning remains an integration layer to connect to your master template.

## Key endpoints

- `GET /health/live`
- `GET /health/ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/onboarding/status`
- `GET /api/google/connect`
- `GET /api/google/callback`
- `GET /api/google/status`
- `DELETE /api/google/disconnect`
- `POST /api/internal/payments/confirmed`
- `POST /api/agents`
- `GET /api/agents/client/:clientId`
- `POST /api/agents/:id/publish`

## Security note

The backend uses the Supabase service-role key server-side. Keep it server-side only. The eventual public chat page should use the published agent/Dify frontend path; do not expose admin JWTs or Supabase service-role credentials to that page.

### Recommended client flow

`payment webhook -> /api/internal/payments/confirmed -> client_id + setup_token -> /api/auth/register -> login -> Google OAuth -> business/services/hours -> create agent -> publish agent`.

### Dify master-template integration

The backend now stores agent lifecycle fields (`status`, `public_slug`, `dify_app_id`) and prevents publication until Google, services, and business settings are ready. It intentionally does not fabricate Dify API calls without your real Dify API/app-template credentials. Connect your master-template provisioning worker to the authenticated agent creation step and store the resulting Dify app ID in `agents.dify_app_id`.

### Rate limiting

The included limiter is intentionally dependency-free and protects single-instance deployments. If you run multiple API replicas, move the limiter state to a shared store such as Redis before relying on it for global abuse protection.
