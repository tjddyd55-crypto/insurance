import pg from 'pg'
import { assertDatabaseGuard } from './guard.js'
import { ensureQaFixtureFiles } from './fixtureFiles.js'
import { loadQaSnapshot, validateDestination } from './loader.js'
import { extractQaSnapshot, withReadOnlySnapshot } from './source.js'

const { Pool } = pg

function needsSsl(connectionString) {
  try {
    const host = new URL(connectionString).hostname
    return /\.railway\.app$|\.rlwy\.net$|\.railway\.internal$/i.test(host)
  } catch {
    return false
  }
}

function createPool(connectionString, applicationName, readOnly = false) {
  return new Pool({
    connectionString,
    max: 2,
    application_name: applicationName,
    ...(readOnly ? { options: '-c default_transaction_read_only=on' } : {}),
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 20_000,
  })
}

export function resolveQaSnapshotUrls(env = process.env) {
  const sourceUrl = env.QA_SOURCE_DATABASE_URL ?? env.QA_SNAPSHOT_SOURCE_DATABASE_URL
  const destinationUrl = env.QA_DESTINATION_DATABASE_URL ?? env.QA_SNAPSHOT_DESTINATION_DATABASE_URL
  if (!sourceUrl?.trim()) throw new Error('QA_SOURCE_DATABASE_URL이 필요합니다.')
  if (!destinationUrl?.trim()) throw new Error('QA_DESTINATION_DATABASE_URL이 필요합니다.')
  return { sourceUrl, destinationUrl }
}

export async function runQaSnapshot(options, env = process.env) {
  const { sourceUrl, destinationUrl } = resolveQaSnapshotUrls(env)
  const classifications = assertDatabaseGuard({ sourceUrl, destinationUrl, options, env })
  const sourcePool = createPool(sourceUrl, 'qa_snapshot_source_read_only', true)
  const destinationPool = createPool(destinationUrl, 'qa_snapshot_destination')
  try {
    const snapshot = await withReadOnlySnapshot(sourcePool, (client) =>
      extractQaSnapshot(client, options),
    )
    await validateDestination(destinationPool, options.targetUserId)
    if (!options.execute) {
      return { dryRun: true, classifications, manifest: snapshot.manifest }
    }
    const fixtures = await ensureQaFixtureFiles(env.CRM_R2_OBJECT_ROOT)
    snapshot.manifest.qa_fixture_files = {
      extracted: 0,
      loaded: 2,
      keys: [fixtures.pdf.key, fixtures.png.key],
    }
    const loaded = await loadQaSnapshot(destinationPool, snapshot, { ...options, fixtures })
    return { dryRun: false, classifications, ...loaded }
  } finally {
    await Promise.allSettled([sourcePool.end(), destinationPool.end()])
  }
}
