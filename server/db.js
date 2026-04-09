import dotenv from 'dotenv'
import path from 'path'
import pg from 'pg'

dotenv.config({
  path: path.resolve('D:/workspace/insurance/server/.env'),
})

const { Pool } = pg

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL 환경변수가 필요합니다.')
}

const useSsl =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.RAILWAY_ENVIRONMENT)

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
})

export default pool