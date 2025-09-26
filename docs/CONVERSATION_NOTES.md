# Conversation Notes

Date: 2025-09-26 (local dev session)

## Scope
- Define free/pro plan boundaries (free as complete manual household account book).
- Add UI gates for free plan without breaking flows.
- Fix Google auth loop and enable dev without DB.
- Integrate Gmail parser and add a sync button.
- Enable dev switch to disable plan limits.

## Implemented
- UI Gates
  - Transactions (`app/transactions/page.tsx`):
    - Show free monthly limit (100) and disable add when reached.
    - CSV range note; free disables last month/3 months/custom; upgrade link.
    - Label export button for current month on free.
  - Dashboard (`app/(dashboard)/dashboard/page.tsx`):
    - Show current plan badge; add links to /cards and /pricing.
  - Cards (`app/(dashboard)/cards/page.tsx`):
    - New page with mock list; free shows 2-card limit and disables add with upgrade link.

- Plan Utilities (`lib/plan.ts`)
  - Plan limits + helpers.
  - Dev override: `NEXT_PUBLIC_DISABLE_PLAN_LIMITS=true` disables all limits.

- Auth & Session (`lib/auth.ts`)
  - Avoid storing Gmail tokens in JWT (cookie size fix).
  - Try/catch around Prisma calls; continue with plan='FREE'.
  - Dev no-DB mode: `NEXT_PUBLIC_AUTH_NO_DB=true` skips Prisma and sets minimal session fields.
  - On signIn (DB mode), upsert EmailAccount with encrypted tokens.
  - Debug enabled for NextAuth.

- Session Debug
  - Public `/me` page to display session JSON.

- Gmail Parser Integration
  - Parser module at `lib/gmail-card-parser.ts` (integrated TypeScript from user).
  - Scan API: `POST /api/email/scan-now`
    - DB mode: decrypt EmailAccount token and scan.
    - No-DB mode: use `GMAIL_ACCESS_TOKEN`.
    - Returns transactionsFound, sample, summary.

- Sync Button
  - `components/dashboard/SyncNowButton.tsx` wired into dashboard header; shows result inline.

- Persistence (initial)
  - Extend `POST /api/email/scan-now` with optional `{ save: true }` to persist.
  - Saves `EmailData` with messageId dedupe per account.
  - Creates `Transaction` linked to default/first active card and category.
  - Maps parser category to DB category (e.g. サブすく -> サブスクリプション).

## Dev Modes
- A) No-DB (fastest):
  - `.env.local`: `NEXT_PUBLIC_AUTH_NO_DB=true`, `NEXT_PUBLIC_DISABLE_PLAN_LIMITS=true`, `GMAIL_ACCESS_TOKEN=...`.
- B) DB (Supabase/Postgres):
  - Set `DATABASE_URL`/`DIRECT_URL` to Postgres.
  - `npx prisma db push`.
  - Google sign-in saves EmailAccount; run Sync.

## Current Status
- Auth loop resolved; `/me` shows session when Google sign-in completes.
- Sync button calls `/api/email/scan-now` and reports results.
- Plan limits can be disabled in dev via env flag.

## Next Steps (options)
- Replace dashboard/subscriptions/transactions mock data with real queries.
- Replace dashboard/subscriptions/transactions mock data with real queries.
- CSV export API + server-side plan gates (enable later when leaving dev mode).
- Refresh token flow for Gmail (access token renewal).

## Notes
- Ensure Google OAuth scope includes `gmail.readonly`.
- Update `NEXTAUTH_URL` to match access URL.
- Clear cookies when changing auth/DB flags; restart dev server after env changes.
