import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const INIT_DB_PATH = join(dirname(fileURLToPath(import.meta.url)), 'initDb.js')
const initDbSource = readFileSync(INIT_DB_PATH, 'utf8')

function extractCustomerNewsCommentsBlock() {
  const start = initDbSource.indexOf('CREATE TABLE IF NOT EXISTS customer_news_comments')
  assert.ok(start >= 0, 'customer_news_comments DDL must exist')
  const end = initDbSource.indexOf('CREATE TABLE IF NOT EXISTS insurance_company_merge_logs', start)
  assert.ok(end > start, 'customer_news_comments block must be bounded')
  return initDbSource.slice(start, end)
}

describe('initDb customer_news_comments schema', () => {
  const ddl = extractCustomerNewsCommentsBlock()

  it('uses additive CREATE TABLE IF NOT EXISTS with required columns', () => {
    assert.match(ddl, /CREATE TABLE IF NOT EXISTS customer_news_comments/)
    assert.match(ddl, /id TEXT PRIMARY KEY/)
    assert.match(ddl, /newsletter_id TEXT NOT NULL REFERENCES insurance_company_newsletters\(id\) ON DELETE CASCADE/)
    assert.match(ddl, /ga_id INTEGER NOT NULL REFERENCES ga_companies\(id\)/)
    assert.match(ddl, /author_user_id TEXT NOT NULL REFERENCES users\(id\)/)
    assert.match(ddl, /author_type TEXT NOT NULL DEFAULT 'agent'/)
    assert.match(ddl, /author_name TEXT NOT NULL DEFAULT ''/)
    assert.match(ddl, /content TEXT NOT NULL/)
    assert.match(ddl, /created_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/)
    assert.match(ddl, /updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/)
  })

  it('indexes comments by newsletter and created_at for list ordering', () => {
    assert.match(initDbSource, /CREATE INDEX IF NOT EXISTS idx_customer_news_comments_newsletter_created/)
    assert.match(initDbSource, /ON customer_news_comments \(newsletter_id, created_at ASC\)/)
  })

  it('does not include destructive DDL for customer_news_comments', () => {
    assert.doesNotMatch(ddl, /DROP TABLE customer_news_comments/i)
    assert.doesNotMatch(ddl, /TRUNCATE customer_news_comments/i)
    assert.doesNotMatch(ddl, /ALTER TABLE customer_news_comments DROP/i)
  })

  it('remains idempotent when initDb is executed repeatedly', () => {
    const createCount = (initDbSource.match(/CREATE TABLE IF NOT EXISTS customer_news_comments/g) ?? []).length
    const indexCount = (initDbSource.match(/CREATE INDEX IF NOT EXISTS idx_customer_news_comments_newsletter_created/g) ?? []).length
    assert.equal(createCount, 1)
    assert.equal(indexCount, 1)
  })
})
