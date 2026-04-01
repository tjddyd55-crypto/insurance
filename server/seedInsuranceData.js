import pool from './db.js'

/**
 * 보험사 디렉터리(insurance_company_*) 테이블이 비어 있을 때만 시드합니다.
 * 서버 기동 시 1회에 해당하는 idempotent 동작입니다.
 */
export async function seedInsuranceCompanyDirectory() {
  const countResult = await pool.query(`SELECT COUNT(*)::int AS c FROM insurance_company_master`)
  if ((countResult.rows[0]?.c ?? 0) > 0) {
    return
  }

  const companies = [
    {
      category: '생명',
      name: 'DB생명',
      customer_center: '1588-0100',
      system_phone: '02-2100-0000',
      incall_number: '070-0000-1111',
      visit_info: '평일 09–18 / 금요일 카톡 가능',
      contacts: [
        { name: '홍길동', position: '지점장', phone: '010-9000-0001' },
        { name: '김철수', position: '매니저', phone: '010-9000-0002' },
      ],
      general: {
        description: '일반화재 설계의뢰 (화재·재물)',
        phone: '02-2100-8888',
        fax: '02-2100-8889',
        email: 'general.fire@example.com',
      },
    },
    {
      category: '손해',
      name: '샘플손해보험',
      customer_center: '1566-0000',
      system_phone: '02-0000-1000',
      incall_number: '070-1000-2000',
      visit_info: '방문: 화·목 (사전 연락)',
      contacts: [{ name: '이영희', position: 'RM', phone: '010-8000-3000' }],
      general: {
        description: '',
        phone: '',
        fax: '',
        email: '',
      },
    },
    {
      category: '생명',
      name: '메리츠화재',
      customer_center: '1566-7711',
      system_phone: '02-2010-0000',
      incall_number: '',
      visit_info: '온라인 접수 우선',
      contacts: [
        { name: '박대리', position: '담당', phone: '010-7000-4000' },
        { name: '최주임', position: '보조', phone: '010-7000-4001' },
      ],
      general: {
        description: '일반화재 접수 창구',
        phone: '02-2010-7777',
        fax: '',
        email: 'request@example.com',
      },
    },
  ]

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const row of companies) {
      const ins = await client.query(
        `
        INSERT INTO insurance_company_master (
          category, name, customer_center, system_phone, incall_number, visit_info
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        `,
        [
          row.category,
          row.name,
          row.customer_center,
          row.system_phone,
          row.incall_number,
          row.visit_info,
        ],
      )
      const companyId = ins.rows[0].id

      for (const c of row.contacts) {
        await client.query(
          `
          INSERT INTO insurance_company_contacts (company_id, name, position, phone)
          VALUES ($1, $2, $3, $4)
          `,
          [companyId, c.name, c.position, c.phone],
        )
      }

      const g = row.general ?? {}
      await client.query(
        `
        INSERT INTO insurance_general_request (company_id, description, phone, fax, email)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          companyId,
          String(g.description ?? ''),
          String(g.phone ?? ''),
          String(g.fax ?? ''),
          String(g.email ?? ''),
        ],
      )
    }

    await client.query('COMMIT')
    console.log('[seed] insurance_company_* 초기 데이터 삽입 완료:', companies.length, '건')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
