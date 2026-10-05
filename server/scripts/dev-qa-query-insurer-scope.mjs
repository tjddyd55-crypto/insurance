import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL required')
  process.exit(1)
}
const client = new pg.Client({ connectionString })
await client.connect()
const r = await client.query(`
  SELECT id, name, company_code
  FROM insurance_company_master
  WHERE ga_id = 1
  ORDER BY id
  LIMIT 10
`)
const att = await client.query(`
  SELECT n.payload->>'insurerCode' AS insurer_code,
         n.payload->>'insurerSlug' AS insurer_slug,
         a.object_key,
         a.url
  FROM insurance_company_newsletter_attachments a
  JOIN insurance_company_newsletters n ON n.id = a.newsletter_id
  WHERE n.ga_id = 1
  ORDER BY a.created_at DESC
  LIMIT 5
`)
console.log(JSON.stringify({ companies: r.rows, attachments: att.rows }, null, 2))
await client.end()
