# Firebase / FCM setup (CRM Android push)

Package: `com.onefc.app`  
채널: `claim_notifications` / 보험 청구 알림

## Do not commit

- `google-services.json`
- Firebase service account JSON / private keys
- Production credentials into develop by mistake

## Server (Railway develop)

Set these env vars (values only in Railway; names are in `server/.env.example`):

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (use `\n` for newlines)

Without these, claim save and in-app notifications still work; push outbox skips send (`firebase_not_configured`).

## Android native build

1. Firebase Console → project for ONE FC CRM app
2. Add Android app with package `com.onefc.app`
3. Download `google-services.json` into `apps/mobile/` (local only)
4. Optionally set `android.googleServicesFile` in `app.json`
5. **Rebuild** native binary (EAS preview/internal). First FCM enablement is not OTA-only.
6. QA with `EXPO_PUBLIC_API_ORIGIN=https://insurance-dev.up.railway.app` when testing develop backend

## Phase 1 limits

- Develop Firebase + QA/internal Android only
- No production Firebase credential, no Play production release, no main push until approved
- Event: `CUSTOMER_CLAIM_SUBMITTED` only
