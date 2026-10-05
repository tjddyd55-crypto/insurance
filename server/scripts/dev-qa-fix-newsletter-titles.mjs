import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query(`
  UPDATE insurance_company_newsletters
  SET body_text = payload->>'summary'
  WHERE payload->>'summary' LIKE '[QA]%'
    AND ga_id = 1
`)
const r = await client.query(`
  SELECT id, body_text FROM insurance_company_newsletters
  WHERE payload->>'summary' LIKE '[QA]%'
  ORDER BY created_at DESC
`)
console.log(JSON.stringify(r.rows, null, 2))
await client.end()
