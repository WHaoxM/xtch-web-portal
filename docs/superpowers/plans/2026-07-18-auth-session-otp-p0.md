# Auth Session + Email OTP (P0) Implementation Plan

> **For agentic workers:** Use executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Same-device silent refresh; email 6-digit OTP on-page; Admin allowlist before send; magic link off primary CTA.

**Architecture:** `@supabase/supabase-js` singleton; `authClient.ts` facade; Admin OTP via server allowlist; client `verifyOtp`.

**Tech Stack:** React + Vite HashRouter, existing APIs, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-07-18-auth-session-otp-design.md`

## Global Constraints

- Do not add Microsoft/password/Passkey/Clerk/BFF.
- Do not change Supabase email templates in code (ops docs only).
- Do not dual-write old `syncing_travel_auth_session` after migration.
- New dependency `@supabase/supabase-js` is pre-approved (scheme 2).
- Do not create git commits unless the user explicitly asks.

## File map

| File | Role |
|------|------|
| `app/package.json` | Add `@supabase/supabase-js` |
| `app/src/lib/supabaseClient.ts` | createClient singleton |
| `app/src/lib/authClient.ts` | Session facade, OTP, migrate, ensureFreshSession |
| `app/api/admin/auth-otp.ts` | Allowlist + send OTP |
| `app/api/admin/auth-magic-link.ts` | Alias → same handler (or thin re-export) |
| `app/scripts/localApiRoutes.ts` | Register `/api/admin/auth-otp` |
| `app/src/pages/Admin.tsx` | SignIn OTP two-step |
| `app/src/components/ChinaTripsMobile.tsx` | Traveler OTP two-step |
| `app/src/pages/AuthCallback.tsx` | OAuth + residual tokens; copy tweak |
| `app/src/lib/orderClient.ts` | 401 → refresh once |
| `app/src/pages/Account.tsx` | Auth state sync (no dual-write key) |
| `docs/agent-gotchas.md`, `docs/ops/win11-home.md` | OTP template + refresh ops |

---

### Task 0: Spec docs

- [x] Write design spec under `docs/superpowers/specs/`
- [x] Write this plan under `docs/superpowers/plans/`

---

### Task 1: Supabase client + session facade

- [x] Install `@supabase/supabase-js` in `app/`
- [x] Create `supabaseClient.ts` (`autoRefreshToken`, `persistSession`, `detectSessionInUrl`)
- [x] Refactor `authClient.ts`: SDK session, migrate old key, `ensureFreshSession`, `sendAdminOtp` / `sendEmailOtp` / `verifyEmailOtp`
- [x] `npm run build` / `lint` after facade lands (or with UI in same batch)

---

### Task 2: Admin OTP API + UI

- [x] `POST /api/admin/auth-otp` — allowlist → OTP without redirect; `shouldCreateUser: false`
- [x] Wire routes; keep `/api/admin/auth-magic-link` as alias
- [x] Admin SignIn: email → code → verify; 60s resend; no magic-link primary CTA

---

### Task 3: Traveler OTP UI

- [x] China Trips SignIn: OTP two-step; Google/Apple unchanged
- [x] `shouldCreateUser: true` (allow register)

---

### Task 4: Callback / 401 / docs

- [x] AuthCallback copy + OAuth path still works
- [x] `fetchMyOrders` / Admin `me`: 401 → `ensureFreshSession` once
- [x] Update gotchas + win11-home OTP template checklist

---

### Task 5: Verify

- [x] `npm run build` + `npm run lint` in `app/`
- [ ] Optional: `build:win11-home` if user wants LAN Admin smoke
