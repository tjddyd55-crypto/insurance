/**
 * Railway Postgres public TCP proxy host 목록 (비밀 아님).
 * Railway Dashboard → Postgres → Connect → Public Network 에서 확인.
 * 프록시가 바뀌면 docs/ops/database-environments.md 와 함께 갱신한다.
 *
 * @see docs/ops/database-environments.md
 */

/** production Postgres — 로컬 server/.env 에 잘못 두면 dev UI 와 count 가 어긋난다 */
export const RAILWAY_PRODUCTION_PUBLIC_DB_HOSTS = ['shortline.proxy.rlwy.net']

/** development Postgres — Railway development/app 이 내부 DNS 로 연결하는 인스턴스의 public proxy */
export const RAILWAY_DEVELOPMENT_PUBLIC_DB_HOSTS = ['tramway.proxy.rlwy.net']
