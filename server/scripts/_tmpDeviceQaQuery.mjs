import pg from 'pg'

const p = new pg.Pool({
  connectionString: process.env.DEV_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const users = await p.query(`
  SELECT u.id, u.username,
    (SELECT COUNT(*)::int FROM user_push_devices d
     WHERE d.user_id = u.id AND d.app_package = 'com.onefc.app.dev' AND d.is_active = true) AS push_dev
  FROM users u
  WHERE u.username IN ('tjddyd55', 'qa-ui-trial-mqnwj565d2tc')
     OR u.id = '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87'
`)

const cust = await p.query(`
  SELECT c.id, c.name, c.gender, c.next_age_date
  FROM customers c
  JOIN users u ON u.ga_id = c.ga_id
  WHERE u.username = 'tjddyd55' AND c.deleted_at IS NULL
  ORDER BY c.id
  LIMIT 30
`)

const grouped = await p.query(`
  SELECT c.latitude, c.longitude, COUNT(*)::int AS cnt,
         MIN(c.name) AS rep,
         array_agg(c.name ORDER BY c.id) AS names
  FROM customers c
  JOIN users u ON u.ga_id = c.ga_id
  WHERE u.username = 'tjddyd55'
    AND c.deleted_at IS NULL
    AND c.latitude IS NOT NULL
    AND c.longitude IS NOT NULL
  GROUP BY c.latitude, c.longitude
  HAVING COUNT(*) > 1
  ORDER BY cnt DESC
  LIMIT 5
`)

const claims = await p.query(`
  SELECT r.id, r.customer_id, c.name
  FROM customer_claim_requests r
  JOIN users u ON u.id = r.agent_id
  JOIN customers c ON c.id = r.customer_id
  WHERE u.username = 'tjddyd55'
  ORDER BY r.id DESC
  LIMIT 5
`)

const news = await p.query(`
  SELECT cn.id, cn.content
  FROM customer_news cn
  WHERE cn.ga_id = (SELECT ga_id FROM users WHERE username = 'tjddyd55')
  ORDER BY cn.id DESC
  LIMIT 5
`)

const insurerNews = await p.query(`
  SELECT n.id, n.title
  FROM newsletters n
  WHERE n.title ILIKE '%QA%'
  ORDER BY n.id DESC
  LIMIT 10
`)

console.log(
  JSON.stringify(
    {
      users: users.rows,
      male: cust.rows.filter((r) => r.gender === 'male').slice(0, 3),
      female: cust.rows.filter((r) => r.gender === 'female').slice(0, 3),
      noGender: cust.rows.filter((r) => !r.gender).slice(0, 3),
      dday: cust.rows.filter((r) => r.next_age_date).slice(0, 5),
      grouped: grouped.rows,
      claims: claims.rows,
      news: news.rows,
      insurerNews: insurerNews.rows,
    },
    null,
    2,
  ),
)

await p.end()
