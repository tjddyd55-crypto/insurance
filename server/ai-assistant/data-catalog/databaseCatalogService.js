import { listAiSemanticFields, summarizeAiSemanticCatalog } from '../../../shared/ai-assistant/semanticDataCatalog.js'

let cache = null
let cacheAt = 0
const CACHE_MS = 5 * 60 * 1000

export async function getDatabaseCatalog(pool, options = {}) {
  const force = options.force === true
  if (!force && cache && Date.now() - cacheAt < CACHE_MS) {
    return cache
  }

  const [columnsResult, fkResult] = await Promise.all([
    pool.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `),
    pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `),
  ])

  const semanticByStorage = new Map()
  for (const semantic of listAiSemanticFields()) {
    const key = `${semantic.storage.table}.${semantic.storage.column}`
    if (!semanticByStorage.has(key)) semanticByStorage.set(key, [])
    semanticByStorage.get(key).push(semantic)
  }

  const foreignKeyByColumn = new Map(
    fkResult.rows.map((row) => [
      `${row.table_name}.${row.column_name}`,
      {
        table: String(row.foreign_table_name),
        column: String(row.foreign_column_name),
      },
    ]),
  )

  const tableMap = new Map()
  for (const row of columnsResult.rows) {
    const tableName = String(row.table_name)
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { tableName, columns: [] })
    }
    tableMap.get(tableName).columns.push({
      columnName: String(row.column_name),
      dataType: String(row.data_type),
      udtName: String(row.udt_name ?? ''),
      nullable: String(row.is_nullable) === 'YES',
      hasDefault: row.column_default != null,
      foreignKey: foreignKeyByColumn.get(`${tableName}.${row.column_name}`) ?? null,
      semanticDefinitions: (semanticByStorage.get(`${tableName}.${row.column_name}`) ?? []).map((semantic) => ({
        key: semantic.key,
        label: semantic.label,
        description: semantic.description,
        valueType: semantic.valueType,
        privacyLevel: semantic.privacyLevel,
        canonicalValues: semantic.canonicalValues,
        systemManaged: semantic.systemManaged,
        capabilities: semantic.capabilities,
        queryKey: semantic.query?.key ?? null,
      })),
    })
  }

  const tables = [...tableMap.values()]
  cache = {
    schema: 'public',
    generatedAt: new Date().toISOString(),
    tableCount: tables.length,
    columnCount: columnsResult.rows.length,
    foreignKeyCount: fkResult.rows.length,
    semanticCatalog: summarizeAiSemanticCatalog(),
    semanticDefinedColumnCount: tables.reduce(
      (sum, table) => sum + table.columns.filter((column) => column.semanticDefinitions.length > 0).length,
      0,
    ),
    tables,
  }
  cacheAt = Date.now()
  return cache
}

export async function getDatabaseCatalogDigest(pool) {
  const catalog = await getDatabaseCatalog(pool)
  return {
    tableCount: catalog.tableCount,
    columnCount: catalog.columnCount,
    foreignKeyCount: catalog.foreignKeyCount,
    tables: catalog.tables.map((table) => ({
      tableName: table.tableName,
      columns: table.columns.map((column) => column.columnName),
    })),
  }
}
