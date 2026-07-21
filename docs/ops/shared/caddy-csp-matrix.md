# Caddy CSP matrix (V1 — draft only)

Strict `Content-Security-Policy` is **not** enabled in `deploy/*/Caddyfile` for V1.

Enable only after this matrix is filled against a real `build:cloud-vps` / `build:win11-home` page load (browser DevTools → Network + Console) and Coordinator/user sign-off.

## Required allowlist sources to verify

| Feature | Typical origins / notes | Status |
|---|---|---|
| Self (HTML/JS/CSS) | `'self'` | pending |
| Inline / Vite | Prefer hashes/nonces; avoid `'unsafe-inline'` if possible | pending |
| Supabase Auth / API | `VITE_SUPABASE_URL` host | pending |
| Stripe.js / Checkout | `https://js.stripe.com`, `https://hooks.stripe.com`, Checkout domains | pending |
| Cloudflare Turnstile | `https://challenges.cloudflare.com` | pending |
| Images (static) | `'self'`, `data:` if used | pending |
| Images / media via `/s3` | `'self'` (same-origin `/s3/...`) — do **not** require public MinIO host | pending |
| Fonts | inventory after build | pending |
| connect-src APIs | `'self'` + Supabase + Stripe + Turnstile siteverify path (server-side) | pending |
| frame-src | Stripe/Turnstile iframes if any | pending |

## Must not break

- BrowserRouter deep links (SPA shell under Caddy `handle`)
- `POST /api/stripe-webhook` (body limited separately to 256 KiB)
- `GET`/`PUT` `/s3/*` object access

## Suggested rollout

1. Record failing console CSP errors on staging with `Content-Security-Policy-Report-Only`.
2. Tighten to enforcing CSP only after zero unexpected reports for critical flows (home, checkout, Admin login, media upload).
3. Keep edge security headers already shipped (HSTS, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy).
