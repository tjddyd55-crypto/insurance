# Production operations scripts

Operator-only scripts under `server/scripts/`. **Do not run mutation/smoke scripts against production without explicit approval.**

## Classification (Phase 2B — updated)

| File | Mode | Guard before | Guard after | Tracking |
|------|------|--------------|-------------|----------|
| `prodBillingBaselineReadonly.mjs` | READONLY | local `.env` only | `productionSafetyGuard` readonly banner + masked DB | **TRACK** (when committed) |
| `alimtalkDirectProductionSmoke.mjs` | MUTATION | provider preflight | + production mutation opt-in (`INSURANCE_OPS_ALLOW_PRODUCTION_MUTATION`) | **TRACK** |
| `authSmsDirectCutoverSmoke.mjs` | MUTATION | provider preflight | + mutation opt-in guard | **TRACK** |
| `crmSmsDirectCutoverSmoke.mjs` | MUTATION | provider/JWT checks | + mutation opt-in guard | **TRACK** |
| `_prodBillingProbe.mjs` | READONLY | none | readonly guard + masked DB | **KEEP_LOCAL** |
| `_prodTjddyd55Baseline.mjs` | READONLY | none | readonly guard | **KEEP_LOCAL** |
| `_prodCheckoutUiQa.mjs` | READONLY | env presence | readonly guard + target URL | **KEEP_LOCAL** |
| `_prodResumeManageQa.mjs` | MUTATION | **none** | dry-run default + prod target + mutation opt-in | **KEEP_LOCAL** (high risk) |
| `_prodResumeMobileQa.mjs` | READONLY | prod URL hardcoded | readonly guard + configurable URL | **KEEP_LOCAL** |
| `_prodResumeQa/*` | ARCHIVE | N/A | gitignored evidence | **ARCHIVE** |

Shared helper: `server/scripts/ops/lib/productionSafetyGuard.mjs` (reuses `dbEnvironmentGuard`).

### Mutation env (names only)

| Env | Purpose |
|-----|---------|
| `INSURANCE_OPS_TARGET_ENVIRONMENT` | `production` \| `development` \| `local` |
| `INSURANCE_OPS_ALLOW_PRODUCTION_MUTATION` | explicit `true` required for prod mutation |
| `INSURANCE_OPS_DRY_RUN` | `true` (default for `_prodResumeManageQa`) skips mutation steps |
| `INSURANCE_OPS_TARGET_URL` | optional API/UI base override |

## Classification (Phase 2A audit — superseded table)

| File | Class | Readonly / Mutation | Guards | Action |
|------|-------|---------------------|--------|--------|
| `prodBillingBaselineReadonly.mjs` | CRITICAL_KEEP | Readonly (SELECT) | Loads local `.env` only; **no prod env name check** | Keep; add `RAILWAY_ENVIRONMENT_NAME` guard in Phase 2B |
| `alimtalkDirectProductionSmoke.mjs` | CRITICAL_KEEP | **Mutation** — 1 real Alimtalk via prod API | Provider preflight, public DB URL, masked logs, rollback hint | Future: `ops/smoke/` |
| `authSmsDirectCutoverSmoke.mjs` | CRITICAL_KEEP | **Mutation** — password-reset OTP SMS | Auth provider check, public DB URL | Future: `ops/smoke/` |
| `crmSmsDirectCutoverSmoke.mjs` | CRITICAL_KEEP | **Mutation** — CRM test SMS | Provider mode, JWT + gateway rollback env | Future: `ops/smoke/` |
| `alimtalkDirectCutoverSmoke.mjs` | CRITICAL_KEEP | (tracked) cutover smoke variant | Same family as above | Already in repo |
| `_prodBillingProbe.mjs` | KEEP_LOCAL | Readonly billing SELECT | **None** — uses `DATABASE_URL` as-is | Stay untracked; operator-only |
| `_prodTjddyd55Baseline.mjs` | KEEP_LOCAL | Readonly user-specific baseline | **None** | Stay untracked |
| `_prodCheckoutUiQa.mjs` | KEEP_LOCAL | Readonly UI (Playwright screenshots) | Requires `DATABASE_URL`, `JWT_SECRET` | Untracked; artifacts gitignored |
| `_prodResumeManageQa.mjs` | KEEP_LOCAL | **Mutation** — clicks billing resume on prod | **None** | **High risk** — do not run casually |
| `_prodResumeMobileQa.mjs` | KEEP_LOCAL | Readonly UI capture | Uses prod URL + JWT | Untracked |
| `_prodResumeQa/results.json` | ARCHIVE | Evidence | N/A | Gitignored |
| `_prodResumeQa/*.png` | ARCHIVE | Screenshots | N/A | Gitignored |

## Required env (names only — never commit values)

| Script family | Typical env |
|---------------|-------------|
| Billing baseline | `DATABASE_URL`, `INSURANCE_BILLING_*`, `RAILWAY_ENVIRONMENT_NAME` |
| Messaging smoke | `JWT_SECRET`, `CRM_SMS_SMOKE_DATABASE_URL` or `DATABASE_PUBLIC_URL`, `AUTH_SMS_PROVIDER`, `SMS_MODULE_PROVIDER`, gateway URLs |
| Playwright QA | `DATABASE_URL`, `JWT_SECRET`, Playwright browsers |

## Safety rules

1. **Readonly** scripts may still expose PII in stdout — redirect output to a secure local file.
2. **Mutation** scripts send real SMS/Alimtalk or change billing state — use approved test receivers only.
3. Never commit `.env`, service account JSON, or QA screenshot folders.
4. Prefer `railway run` with explicit service context over pasting production URLs into local shells.
5. Rollback hints are documented in each smoke script header (e.g. `INSURANCE_ALIMTALK_PROVIDER=gateway`).

## Planned `server/scripts/ops/` layout (Phase 2B+ — no moves yet)

```
ops/
  smoke/          # alimtalkDirectProductionSmoke, auth/crm cutover smokes
  verify/         # prodBillingBaselineReadonly, billing probes
  billing/        # renewal once, baseline readonly
  messaging/      # SMS/alimtalk cutover
  recovery/       # insurer manager recovery (existing run*.mjs)
```

## Phase 2B: auth extraction status

Login/register handlers moved to `server/auth/registerAuthApi.js`. `requireAuth` and JWT secrets remain in `server/index.js` (Phase 2C).

| Symbol | Location after 2B |
|--------|-------------------|
| `handleLogin`, `handleRegister`, `auditLoginFailure` | `server/auth/registerAuthApi.js` |
| Auth routes (`/login`, `/register`, invite URL, username availability) | `registerAuthApi()` |
| `requireAuth`, `JWT_SECRET`, boot guard | `server/index.js` |

| Symbol / route | Lines (approx) | Depends on | Phase 2B extract target |
|----------------|----------------|------------|-------------------------|
| `JWT_SECRET`, `INVITE_SIGNUP_SECRET` | ~192–194 | `process.env` | `server/auth/secrets.js` |
| `requireAuth` middleware | ~1005–1173 | `jwt`, `pool`, role/GA guards | `server/auth/requireAuth.js` |
| `registerAuthAccountSmsApi` | ~1559 | `apiRouter`, SMS providers | keep wiring in index; logic already modular |
| `handleRegister` | ~2103–2495 | bcrypt, invite HMAC, `pool`, SMS proof | `server/auth/register.js` |
| `auditLoginFailure` | ~2497–2509 | `pool`, security audit | `server/auth/loginAudit.js` |
| `handleLogin` | ~2511–2925 | bcrypt, JWT sign, manager/user paths, `pool` | `server/auth/login.js` |
| `POST /login`, `/auth/login` | ~2982–2983 | `handleLogin` | route table / `authRoutes.js` |
| `POST /register`, `/auth/register`, `/auth/signup` | ~2927–2929 | `handleRegister` | route table |
| `GET /auth/invite-signup-url` | ~2931+ | `requireAuth`, invite signing | `server/auth/inviteSignup.js` |
| `GET /auth/username-availability` | ~2984+ | `pool` read-only | same module as register |
| Production JWT guard | ~7865–7870 | `RUNNING_IN_PRODUCTION` | `server/auth/bootGuards.js` |

**Wiring order today:** secrets → `requireAuth` definition → `register*Api(..., { requireAuth, JWT_SECRET })` block (~1500–1730) → inline auth routes (~2927–2983) → production boot guard (~7865).

**Do not move yet:** `enforceActiveSubscription`, `enforceInsuranceBillingEntitlement` (subscription domain, but login-adjacent).


## Example (readonly baseline)

```bash
# Local shell with production DATABASE_URL — operator responsibility
node server/scripts/prodBillingBaselineReadonly.mjs
```

## Forbidden

- Running `_prodResumeManageQa.mjs` on shared/production accounts without rollback plan
- Committing `server/scripts/_prod*` mutation scripts without security review
- Using `npm audit fix --force` or prod DB DDL from this folder
