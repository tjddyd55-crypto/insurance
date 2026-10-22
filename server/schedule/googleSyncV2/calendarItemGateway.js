/**
 * 로컬 저장과 outbox 쓰기는 이 트랜잭션 안에서만 한다.
 * Google 호출은 여기 넣지 않는다. 커밋 이후 실패가 로컬 행을 되돌리지 않게 하기 위해서다.
 * @param {{ connect: Function, query: Function }} pool
 */
export function createPgGateway(pool) {
  return {
    query(sql, params) {
      return pool.query(sql, params)
    },
    async transaction(task) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await task(client)
        await client.query('COMMIT')
        return result
      } catch (error) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // 롤백 실패여도 원래 오류를 유지한다.
        }
        throw error
      } finally {
        client.release()
      }
    },
  }
}
