# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Korean insurance management platform (보험 신청·고객관리) for GA (General Agency) companies.
- **Frontend**: React 19 + Vite 7 + TailwindCSS 4 (port 3000)
- **Backend**: Express 5, plain JS ESM (port 3001)
- **Database**: PostgreSQL 16 (schema auto-migrated on startup via `server/initDb.js`)

### Running the dev environment

Standard commands are in `package.json`:
- `npm run dev` — starts Express backend + Vite frontend concurrently
- `npm run build` — production Vite build
- `npm run lint` — ESLint

### Non-obvious caveats

1. **Hardcoded Windows dotenv path in `server/db.js`**: The file has `dotenv.config({ path: path.resolve('D:/workspace/insurance/server/.env') })`. On Linux/macOS this path doesn't exist, so **zero** env vars are injected from that call. You must export environment variables (especially `DATABASE_URL`) in your shell before running `npm run dev`, or the server will crash with `DATABASE_URL 환경변수가 필요합니다.`

2. **Required env vars for local dev** (export before `npm run dev`):
   ```
   DATABASE_URL=postgresql://insurance:insurance@localhost:5432/insurance
   JWT_SECRET=change-this-in-production
   VITE_API_BASE_PATH=/backend
   INSURANCE_ENABLE_ADMIN_BOOTSTRAP=true
   INSURANCE_ADMIN_BOOTSTRAP_USERNAME=admin
   INSURANCE_ADMIN_BOOTSTRAP_PASSWORD=1234
   INSURANCE_SIGNUP_PHONE_RELAXED=1
   VITE_INSURANCE_SIGNUP_PHONE_RELAXED=1
   ```

3. **Fresh DB seed bug — `company_code` NOT NULL**: On a fresh database, `initDb` sets `insurance_company_master.company_code` as NOT NULL, but `seedInsuranceFullData.js` doesn't provide it in the INSERT. Fix: create a `BEFORE INSERT` trigger on `insurance_company_master` that auto-generates `company_code` as `'INS' || LPAD(id::text, 6, '0')` before the seed runs.

4. **Admin bootstrap**: When `INSURANCE_ENABLE_ADMIN_BOOTSTRAP=true`, the server auto-creates an admin account (`admin`/`1234`, role `SUPER_ADMIN`) on startup. This admin cannot access customer management (which requires role `USER`).

5. **Test user account**: Customer management features require a `USER` role account. To create one for testing, insert directly into the `users` table with `role='USER'`, `ga_id=1`, `invited_by_user_id=<admin-uuid>`, and a bcrypt-hashed password in `password_hash`.

6. **PostgreSQL must be running**: Start with `sudo pg_ctlcluster 16 main start` if not already active. Verify with `pg_isready`.

7. **No automated test suite**: The codebase does not include unit or integration tests. Validation relies on `npm run lint` and manual testing.
