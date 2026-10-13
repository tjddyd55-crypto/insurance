import { safeQuery } from '../utils/dbSafeQuery.js'

const FOLDER_NAME_MAX = 12
const SHARED_ROOT_FOLDER_NAME = '공유 바인더'

function normalizeSpaces(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeStorageFolderName(raw) {
  const value = normalizeSpaces(raw)
  if (!value) return ''
  return value.slice(0, FOLDER_NAME_MAX)
}

async function findFolderByName(client, scope, { name, parentId }) {
  const result = await safeQuery(
    client,
    `
    SELECT id, name, parent_id
    FROM folders
    WHERE user_id = $1
      AND ga_id = $2
      AND customer_id IS NULL
      AND parent_id IS NOT DISTINCT FROM $3
      AND lower(btrim(name)) = lower(btrim($4))
    LIMIT 1
    `,
    [scope.userId, scope.gaId, parentId, name],
  )
  return result.rows[0] ?? null
}

async function insertFolder(client, scope, { name, parentId }) {
  const ins = await safeQuery(
    client,
    `
    INSERT INTO folders (user_id, ga_id, customer_id, parent_id, name)
    VALUES ($1, $2, NULL, $3, $4)
    RETURNING id, name, parent_id
    `,
    [scope.userId, scope.gaId, parentId, name],
  )
  return ins.rows[0]
}

/**
 * 내 저장 공간: 공유 바인더 / {가져온 바인더명}
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string, gaId: number }} scope
 * @param {string} binderTitle
 */
export async function ensureImportFolderPath(client, scope, binderTitle) {
  let root = await findFolderByName(client, scope, { name: SHARED_ROOT_FOLDER_NAME, parentId: null })
  if (!root) {
    try {
      root = await insertFolder(client, scope, { name: SHARED_ROOT_FOLDER_NAME, parentId: null })
    } catch (error) {
      if (String(error?.code) === '23505') {
        root = await findFolderByName(client, scope, {
          name: SHARED_ROOT_FOLDER_NAME,
          parentId: null,
        })
      } else {
        throw error
      }
    }
  }
  const parentId = Number(root.id)
  const baseName = normalizeStorageFolderName(binderTitle) || '가져온바인더'
  let candidate = baseName
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const existing = await findFolderByName(client, scope, { name: candidate, parentId })
    if (!existing) {
      const created = await insertFolder(client, scope, { name: candidate, parentId })
      return Number(created.id)
    }
    const suffix = `(${attempt + 2})`
    const trimmed = baseName.slice(0, Math.max(1, FOLDER_NAME_MAX - suffix.length))
    candidate = `${trimmed}${suffix}`.slice(0, FOLDER_NAME_MAX)
  }
  throw Object.assign(new Error('저장 폴더를 만들 수 없습니다.'), { httpStatus: 409 })
}
