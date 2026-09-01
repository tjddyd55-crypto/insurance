import { parseQaSnapshotArgs, runQaSnapshot } from '../qa-snapshot/index.js'

function printableManifest(manifest) {
  return Object.fromEntries(
    Object.entries(manifest).map(([table, result]) => [
      table,
      {
        extracted: Number(result.extracted ?? 0),
        loaded: Number(result.loaded ?? 0),
        skippedRows: Number(result.skippedRows ?? 0),
        ...(result.skipped ? { skipped: result.skipped } : {}),
      },
    ]),
  )
}

async function main() {
  const options = parseQaSnapshotArgs(process.argv.slice(2))
  const result = await runQaSnapshot(options)
  console.log(`[qa-snapshot] mode=${result.dryRun ? 'dry-run' : 'execute'}`)
  console.log(
    `[qa-snapshot] source=${result.classifications.sourceTarget} destination=${result.classifications.destinationTarget}`,
  )
  if (result.runId) console.log(`[qa-snapshot] runId=${result.runId}`)
  console.log('[qa-snapshot] manifest', JSON.stringify(printableManifest(result.manifest)))
}

main().catch((error) => {
  console.error('[qa-snapshot] 실패:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
