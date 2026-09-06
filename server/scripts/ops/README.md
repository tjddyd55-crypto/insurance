# Production operations scripts

Operator-only scripts under `server/scripts/`. **Do not run mutation/smoke scripts against production without explicit approval.**

## Classification (Phase 2A audit)

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

Tracked `run*.mjs` scripts remain at `server/scripts/` until import paths and `package.json` scripts are updated.

## Example (readonly baseline)

```bash
# Local shell with production DATABASE_URL — operator responsibility
node server/scripts/prodBillingBaselineReadonly.mjs
```

## Forbidden

- Running `_prodResumeManageQa.mjs` on shared/production accounts without rollback plan
- Committing `server/scripts/_prod*` mutation scripts without security review
- Using `npm audit fix --force` or prod DB DDL from this folder
