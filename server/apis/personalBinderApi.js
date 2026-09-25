import { createHash } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'

import { readStorageFileBufferFromPath } from '../lib/storageFileObjectKey.js'
import { safeQuery } from '../utils/dbSafeQuery.js'

function requestScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  const gaId = Number(req.user?.gaId)
  if (!userId || !Number.isInteger(gaId) || gaId < 1) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  return { userId, gaId }
}

function positiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function normalizedText(value, maxLength, required = false) {
  const text = String(value ?? '').trim().slice(0, maxLength)
  if (required && !text) return null
  return text
}

export function normalizePageSelection(value, pageCount) {
  if (value == null) return null
  if (!Array.isArray(value)) {
    throw Object.assign(new Error('페이지 선택 형식이 올바르지 않습니다.'), { httpStatus: 400 })
  }
  const pages = [...new Set(value.map(Number))]
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= pageCount)
    .sort((left, right) => left - right)
  if (pages.length === 0 || pages.length !== new Set(value.map(Number)).size) {
    throw Object.assign(new Error('선택 페이지를 확인해 주세요.'), { httpStatus: 400 })
  }
  return pages
}

function mapMaterial(row) {
  return {
    id: String(row.id),
    fileId: Number(row.file_id),
    title: row.title,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size) || 0,
    pageCount: Number(row.page_count) || 0,
    checksumSha256: row.checksum_sha256,
    sourceType: row.source_type,
    binderCount: Number(row.binder_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBinderSummary(row) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    sectionCount: Number(row.section_count) || 0,
    materialCount: Number(row.material_count) || 0,
    pageCount: Number(row.page_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getOwnedBinder(executor, binderId, scope) {
  const result = await safeQuery(
    executor,
    `
    SELECT id, title, description, created_at, updated_at
    FROM personal_binders
    WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [binderId, scope.userId, scope.gaId],
  )
  return result.rows[0] ?? null
}

async function getOwnedSection(executor, sectionId, scope) {
  const result = await safeQuery(
    executor,
    `
    SELECT s.id, s.binder_id, s.title, s.sort_order
    FROM personal_binder_sections s
    INNER JOIN personal_binders b ON b.id = s.binder_id
    WHERE s.id = $1
      AND b.owner_user_id = $2
      AND b.ga_id = $3
      AND b.deleted_at IS NULL
    LIMIT 1
    `,
    [sectionId, scope.userId, scope.gaId],
  )
  return result.rows[0] ?? null
}

async function loadBinderDetail(executor, binderId, scope) {
  const binder = await getOwnedBinder(executor, binderId, scope)
  if (!binder) return null
  const sections = await safeQuery(
    executor,
    `
    SELECT id, title, sort_order, created_at, updated_at
    FROM personal_binder_sections
    WHERE binder_id = $1
    ORDER BY sort_order ASC, id ASC
    `,
    [binderId],
  )
  const items = await safeQuery(
    executor,
    `
    SELECT
      i.id,
      i.section_id,
      i.material_id,
      i.sort_order,
      i.page_selection,
      i.created_at,
      i.updated_at,
      m.file_id,
      m.title AS material_title,
      m.original_file_name,
      m.mime_type,
      m.file_size,
      m.page_count
    FROM personal_binder_items i
    INNER JOIN personal_binder_sections s ON s.id = i.section_id
    INNER JOIN personal_binder_materials m ON m.id = i.material_id
    WHERE s.binder_id = $1 AND m.deleted_at IS NULL
    ORDER BY s.sort_order ASC, i.sort_order ASC, i.id ASC
    `,
    [binderId],
  )
  const bySection = new Map()
  for (const item of items.rows) {
    const key = String(item.section_id)
    const rows = bySection.get(key) ?? []
    rows.push({
      id: String(item.id),
      sectionId: key,
      materialId: String(item.material_id),
      sortOrder: Number(item.sort_order),
      pageSelection: item.page_selection,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      material: {
        id: String(item.material_id),
        fileId: Number(item.file_id),
        title: item.material_title,
        originalFileName: item.original_file_name,
        mimeType: item.mime_type,
        fileSize: Number(item.file_size) || 0,
        pageCount: Number(item.page_count) || 0,
      },
    })
    bySection.set(key, rows)
  }
  return {
    id: String(binder.id),
    title: binder.title,
    description: binder.description,
    createdAt: binder.created_at,
    updatedAt: binder.updated_at,
    sections: sections.rows.map((section) => ({
      id: String(section.id),
      binderId: String(binder.id),
      title: section.title,
      sortOrder: Number(section.sort_order),
      createdAt: section.created_at,
      updatedAt: section.updated_at,
      items: bySection.get(String(section.id)) ?? [],
    })),
  }
}

export async function normalizeOrder(client, table, parentColumn, parentId, ids) {
  const allowed = table === 'personal_binder_sections'
    ? { idColumn: 'id' }
    : table === 'personal_binder_items'
      ? { idColumn: 'id' }
      : null
  if (!allowed) throw new Error('unsupported reorder table')
  const current = await client.query(
    `SELECT ${allowed.idColumn} AS id FROM ${table} WHERE ${parentColumn} = $1 ORDER BY sort_order, id`,
    [parentId],
  )
  const currentIds = current.rows.map((row) => String(row.id))
  const requested = ids.map(String)
  if (
    requested.length !== currentIds.length ||
    new Set(requested).size !== requested.length ||
    currentIds.some((id) => !requested.includes(id))
  ) {
    throw Object.assign(new Error('순서 변경 대상이 일치하지 않습니다.'), { httpStatus: 409 })
  }
  await client.query(
    `UPDATE ${table} SET sort_order = sort_order + 100000 WHERE ${parentColumn} = $1`,
    [parentId],
  )
  for (let index = 0; index < requested.length; index += 1) {
    await client.query(
      `UPDATE ${table} SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND ${parentColumn} = $3`,
      [index, requested[index], parentId],
    )
  }
}

function sendError(error, req, res, handleDbError) {
  if (error?.httpStatus) {
    res.status(error.httpStatus).json({ message: error.message, code: error.code })
    return
  }
  handleDbError(error, req, res)
}

export function registerPersonalBinderApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/personal-binders/materials', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const result = await safeQuery(
        pool,
        `
        SELECT m.*, COUNT(DISTINCT s.binder_id)::int AS binder_count
        FROM personal_binder_materials m
        LEFT JOIN personal_binder_items i ON i.material_id = m.id
        LEFT JOIN personal_binder_sections s ON s.id = i.section_id
        WHERE m.owner_user_id = $1 AND m.ga_id = $2 AND m.deleted_at IS NULL
        GROUP BY m.id
        ORDER BY m.updated_at DESC, m.id DESC
        `,
        [scope.userId, scope.gaId],
      )
      res.json(result.rows.map(mapMaterial))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.post('/personal-binders/materials/check-duplicate', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const checksum = String(req.body?.checksumSha256 ?? '').trim().toLowerCase()
      if (!/^[a-f0-9]{64}$/.test(checksum)) {
        res.status(400).json({ message: '파일 체크섬이 올바르지 않습니다.' })
        return
      }
      const result = await safeQuery(
        pool,
        `
        SELECT m.*, COUNT(DISTINCT s.binder_id)::int AS binder_count
        FROM personal_binder_materials m
        LEFT JOIN personal_binder_items i ON i.material_id = m.id
        LEFT JOIN personal_binder_sections s ON s.id = i.section_id
        WHERE m.owner_user_id = $1 AND m.ga_id = $2
          AND m.checksum_sha256 = $3 AND m.deleted_at IS NULL
        GROUP BY m.id
        LIMIT 1
        `,
        [scope.userId, scope.gaId, checksum],
      )
      res.json({ duplicate: result.rowCount > 0, material: result.rows[0] ? mapMaterial(result.rows[0]) : null })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.post('/personal-binders/materials', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const fileId = positiveId(req.body?.fileId)
      const title = normalizedText(req.body?.title, 200, true)
      if (!fileId || !title) {
        res.status(400).json({ message: '파일과 자료 제목이 필요합니다.' })
        return
      }
      const fileResult = await safeQuery(
        pool,
        `
        SELECT id, original_name, display_name, file_path, file_size, mime_type
        FROM files
        WHERE id = $1 AND user_id = $2 AND ga_id = $3
          AND customer_id IS NULL AND status = 'active' AND deleted_at IS NULL
        LIMIT 1
        `,
        [fileId, scope.userId, scope.gaId],
      )
      const file = fileResult.rows[0]
      if (!file) {
        res.status(404).json({ message: '업로드한 PDF 파일을 찾을 수 없습니다.' })
        return
      }
      const mimeType = String(file.mime_type ?? '').toLowerCase()
      const originalName = String(file.original_name ?? file.display_name ?? '')
      if (mimeType !== 'application/pdf' || !originalName.toLowerCase().endsWith('.pdf')) {
        res.status(400).json({ message: 'PDF 파일만 자료로 등록할 수 있습니다.' })
        return
      }
      const objectKey = String(file.file_path ?? '').trim()
      const buffer = await readStorageFileBufferFromPath(objectKey)
      if (!buffer?.length || buffer.subarray(0, 5).toString() !== '%PDF-') {
        res.status(400).json({ message: 'PDF 파일 형식이 올바르지 않습니다.' })
        return
      }
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: false })
      const pageCount = pdf.getPageCount()
      const checksum = createHash('sha256').update(buffer).digest('hex')
      const duplicate = await safeQuery(
        pool,
        `
        SELECT id FROM personal_binder_materials
        WHERE owner_user_id = $1 AND ga_id = $2 AND checksum_sha256 = $3 AND deleted_at IS NULL
        LIMIT 1
        `,
        [scope.userId, scope.gaId, checksum],
      )
      if (duplicate.rowCount > 0) {
        res.status(409).json({
          code: 'DUPLICATE_MATERIAL',
          message: '이미 자료 보관함에 등록된 PDF입니다.',
          materialId: String(duplicate.rows[0].id),
        })
        return
      }
      const insert = await safeQuery(
        pool,
        `
        INSERT INTO personal_binder_materials (
          owner_user_id, ga_id, file_id, title, original_file_name,
          mime_type, file_size, page_count, checksum_sha256
        )
        VALUES ($1, $2, $3, $4, $5, 'application/pdf', $6, $7, $8)
        RETURNING *, 0::int AS binder_count
        `,
        [scope.userId, scope.gaId, fileId, title, originalName, Number(file.file_size) || buffer.length, pageCount, checksum],
      )
      res.status(201).json(mapMaterial(insert.rows[0]))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.patch('/personal-binders/materials/:materialId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const materialId = positiveId(req.params.materialId)
      const title = normalizedText(req.body?.title, 200, true)
      if (!materialId || !title) {
        res.status(400).json({ message: '자료 제목을 입력해 주세요.' })
        return
      }
      const result = await safeQuery(
        pool,
        `
        UPDATE personal_binder_materials
        SET title = $1, updated_at = NOW()
        WHERE id = $2 AND owner_user_id = $3 AND ga_id = $4 AND deleted_at IS NULL
        RETURNING *, (
          SELECT COUNT(DISTINCT s.binder_id)::int
          FROM personal_binder_items i
          INNER JOIN personal_binder_sections s ON s.id = i.section_id
          WHERE i.material_id = personal_binder_materials.id
        ) AS binder_count
        `,
        [title, materialId, scope.userId, scope.gaId],
      )
      if (result.rowCount === 0) {
        res.status(404).json({ message: '자료를 찾을 수 없습니다.' })
        return
      }
      res.json(mapMaterial(result.rows[0]))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.delete('/personal-binders/materials/:materialId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const materialId = positiveId(req.params.materialId)
      if (!materialId) {
        res.status(400).json({ message: '잘못된 자료 ID입니다.' })
        return
      }
      const material = await safeQuery(
        pool,
        `
        SELECT m.id, m.file_id, COUNT(DISTINCT s.binder_id)::int AS binder_count
        FROM personal_binder_materials m
        LEFT JOIN personal_binder_items i ON i.material_id = m.id
        LEFT JOIN personal_binder_sections s ON s.id = i.section_id
        WHERE m.id = $1 AND m.owner_user_id = $2 AND m.ga_id = $3 AND m.deleted_at IS NULL
        GROUP BY m.id
        `,
        [materialId, scope.userId, scope.gaId],
      )
      if (material.rowCount === 0) {
        res.status(404).json({ message: '자료를 찾을 수 없습니다.' })
        return
      }
      const row = material.rows[0]
      if (Number(row.binder_count) > 0) {
        res.status(409).json({
          code: 'MATERIAL_IN_USE',
          message: `이 자료는 ${row.binder_count}개의 바인더에서 사용 중입니다.`,
          binderCount: Number(row.binder_count),
        })
        return
      }
      await safeQuery(
        pool,
        `
        UPDATE personal_binder_materials SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3
        `,
        [materialId, scope.userId, scope.gaId],
      )
      res.json({ ok: true, fileId: Number(row.file_id) })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.get('/personal-binders', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const result = await safeQuery(
        pool,
        `
        SELECT
          b.*,
          COUNT(DISTINCT s.id)::int AS section_count,
          COUNT(DISTINCT i.material_id)::int AS material_count,
          COALESCE(SUM(
            CASE WHEN i.id IS NULL THEN 0
              WHEN i.page_selection IS NULL THEN m.page_count
              ELSE jsonb_array_length(i.page_selection)
            END
          ), 0)::int AS page_count
        FROM personal_binders b
        LEFT JOIN personal_binder_sections s ON s.binder_id = b.id
        LEFT JOIN personal_binder_items i ON i.section_id = s.id
        LEFT JOIN personal_binder_materials m ON m.id = i.material_id AND m.deleted_at IS NULL
        WHERE b.owner_user_id = $1 AND b.ga_id = $2 AND b.deleted_at IS NULL
        GROUP BY b.id
        ORDER BY b.updated_at DESC, b.id DESC
        `,
        [scope.userId, scope.gaId],
      )
      res.json(result.rows.map(mapBinderSummary))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.post('/personal-binders', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const title = normalizedText(req.body?.title, 120, true)
      const description = normalizedText(req.body?.description, 1000) ?? ''
      if (!title) {
        res.status(400).json({ message: '바인더 이름을 입력해 주세요.' })
        return
      }
      const result = await safeQuery(
        pool,
        `
        INSERT INTO personal_binders (owner_user_id, ga_id, title, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *, 0::int AS section_count, 0::int AS material_count, 0::int AS page_count
        `,
        [scope.userId, scope.gaId, title, description],
      )
      res.status(201).json(mapBinderSummary(result.rows[0]))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.get('/personal-binders/:binderId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      const detail = binderId ? await loadBinderDetail(pool, binderId, scope) : null
      if (!detail) {
        res.status(404).json({ message: '바인더를 찾을 수 없습니다.' })
        return
      }
      res.json(detail)
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.patch('/personal-binders/:binderId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      const title = normalizedText(req.body?.title, 120, true)
      const description = normalizedText(req.body?.description, 1000) ?? ''
      if (!binderId || !title) {
        res.status(400).json({ message: '바인더 이름을 입력해 주세요.' })
        return
      }
      const result = await safeQuery(
        pool,
        `
        UPDATE personal_binders
        SET title = $1, description = $2, updated_at = NOW()
        WHERE id = $3 AND owner_user_id = $4 AND ga_id = $5 AND deleted_at IS NULL
        RETURNING id
        `,
        [title, description, binderId, scope.userId, scope.gaId],
      )
      if (result.rowCount === 0) {
        res.status(404).json({ message: '바인더를 찾을 수 없습니다.' })
        return
      }
      res.json(await loadBinderDetail(pool, binderId, scope))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.delete('/personal-binders/:binderId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      const result = binderId
        ? await safeQuery(
          pool,
          `
          UPDATE personal_binders SET deleted_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
          RETURNING id
          `,
          [binderId, scope.userId, scope.gaId],
        )
        : { rowCount: 0 }
      if (result.rowCount === 0) {
        res.status(404).json({ message: '바인더를 찾을 수 없습니다.' })
        return
      }
      res.json({ ok: true })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.post('/personal-binders/:binderId/duplicate', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      const source = binderId ? await getOwnedBinder(client, binderId, scope) : null
      if (!source) {
        res.status(404).json({ message: '바인더를 찾을 수 없습니다.' })
        return
      }
      const requestedTitle = normalizedText(req.body?.title, 120)
      await client.query('BEGIN')
      const binderInsert = await client.query(
        `
        INSERT INTO personal_binders (owner_user_id, ga_id, title, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [scope.userId, scope.gaId, requestedTitle || `${source.title} 복사본`, source.description],
      )
      const newBinderId = binderInsert.rows[0].id
      const sections = await client.query(
        `SELECT id, title, sort_order FROM personal_binder_sections WHERE binder_id = $1 ORDER BY sort_order`,
        [binderId],
      )
      for (const section of sections.rows) {
        const sectionInsert = await client.query(
          `
          INSERT INTO personal_binder_sections (binder_id, title, sort_order)
          VALUES ($1, $2, $3)
          RETURNING id
          `,
          [newBinderId, section.title, section.sort_order],
        )
        await client.query(
          `
          INSERT INTO personal_binder_items (section_id, material_id, sort_order, page_selection)
          SELECT $1, material_id, sort_order, page_selection
          FROM personal_binder_items
          WHERE section_id = $2
          ORDER BY sort_order
          `,
          [sectionInsert.rows[0].id, section.id],
        )
      }
      await client.query('COMMIT')
      res.status(201).json(await loadBinderDetail(pool, newBinderId, scope))
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      sendError(error, req, res, handleDbError)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/personal-binders/:binderId/sections', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      const title = normalizedText(req.body?.title, 120, true)
      if (!binderId || !title || !(await getOwnedBinder(pool, binderId, scope))) {
        res.status(404).json({ message: '바인더를 찾을 수 없습니다.' })
        return
      }
      const result = await pool.query(
        `
        INSERT INTO personal_binder_sections (binder_id, title, sort_order)
        SELECT $1, $2, COALESCE(MAX(sort_order), -1) + 1
        FROM personal_binder_sections WHERE binder_id = $1
        RETURNING *
        `,
        [binderId, title],
      )
      res.status(201).json({
        id: String(result.rows[0].id),
        binderId: String(binderId),
        title: result.rows[0].title,
        sortOrder: Number(result.rows[0].sort_order),
        items: [],
      })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.patch('/personal-binders/sections/:sectionId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const sectionId = positiveId(req.params.sectionId)
      const title = normalizedText(req.body?.title, 120, true)
      const section = sectionId ? await getOwnedSection(pool, sectionId, scope) : null
      if (!section || !title) {
        res.status(404).json({ message: '섹션을 찾을 수 없습니다.' })
        return
      }
      await pool.query(
        `UPDATE personal_binder_sections SET title = $1, updated_at = NOW() WHERE id = $2`,
        [title, sectionId],
      )
      res.json({ ok: true })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.delete('/personal-binders/sections/:sectionId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const sectionId = positiveId(req.params.sectionId)
      const section = sectionId ? await getOwnedSection(pool, sectionId, scope) : null
      if (!section) {
        res.status(404).json({ message: '섹션을 찾을 수 없습니다.' })
        return
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`DELETE FROM personal_binder_sections WHERE id = $1`, [sectionId])
        const remaining = await client.query(
          `SELECT id FROM personal_binder_sections WHERE binder_id = $1 ORDER BY sort_order, id`,
          [section.binder_id],
        )
        await normalizeOrder(client, 'personal_binder_sections', 'binder_id', section.binder_id, remaining.rows.map((row) => row.id))
        await client.query(`UPDATE personal_binders SET updated_at = NOW() WHERE id = $1`, [section.binder_id])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
      res.json({ ok: true })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.put('/personal-binders/:binderId/sections/reorder', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      const ids = Array.isArray(req.body?.sectionIds) ? req.body.sectionIds : []
      if (!binderId || !(await getOwnedBinder(client, binderId, scope))) {
        res.status(404).json({ message: '바인더를 찾을 수 없습니다.' })
        return
      }
      await client.query('BEGIN')
      await normalizeOrder(client, 'personal_binder_sections', 'binder_id', binderId, ids)
      await client.query(`UPDATE personal_binders SET updated_at = NOW() WHERE id = $1`, [binderId])
      await client.query('COMMIT')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      sendError(error, req, res, handleDbError)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/personal-binders/sections/:sectionId/items', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const sectionId = positiveId(req.params.sectionId)
      const materialId = positiveId(req.body?.materialId)
      const section = sectionId ? await getOwnedSection(pool, sectionId, scope) : null
      if (!section || !materialId) {
        res.status(404).json({ message: '섹션 또는 자료를 찾을 수 없습니다.' })
        return
      }
      const material = await safeQuery(
        pool,
        `
        SELECT id, page_count FROM personal_binder_materials
        WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
        LIMIT 1
        `,
        [materialId, scope.userId, scope.gaId],
      )
      if (material.rowCount === 0) {
        res.status(404).json({ message: '자료를 찾을 수 없습니다.' })
        return
      }
      const selection = normalizePageSelection(req.body?.pageSelection, Number(material.rows[0].page_count))
      const result = await pool.query(
        `
        INSERT INTO personal_binder_items (section_id, material_id, sort_order, page_selection)
        SELECT $1, $2, COALESCE(MAX(sort_order), -1) + 1, $3::jsonb
        FROM personal_binder_items WHERE section_id = $1
        RETURNING id
        `,
        [sectionId, materialId, selection == null ? null : JSON.stringify(selection)],
      )
      await pool.query(`UPDATE personal_binders SET updated_at = NOW() WHERE id = $1`, [section.binder_id])
      res.status(201).json({ id: String(result.rows[0].id) })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.patch('/personal-binders/items/:itemId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const itemId = positiveId(req.params.itemId)
      const owned = await safeQuery(
        pool,
        `
        SELECT i.id, i.material_id, s.binder_id, m.page_count
        FROM personal_binder_items i
        INNER JOIN personal_binder_sections s ON s.id = i.section_id
        INNER JOIN personal_binders b ON b.id = s.binder_id
        INNER JOIN personal_binder_materials m ON m.id = i.material_id
        WHERE i.id = $1 AND b.owner_user_id = $2 AND b.ga_id = $3 AND b.deleted_at IS NULL
        LIMIT 1
        `,
        [itemId, scope.userId, scope.gaId],
      )
      if (!itemId || owned.rowCount === 0) {
        res.status(404).json({ message: '바인더 자료를 찾을 수 없습니다.' })
        return
      }
      const selection = normalizePageSelection(req.body?.pageSelection, Number(owned.rows[0].page_count))
      await pool.query(
        `UPDATE personal_binder_items SET page_selection = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [selection == null ? null : JSON.stringify(selection), itemId],
      )
      await pool.query(`UPDATE personal_binders SET updated_at = NOW() WHERE id = $1`, [owned.rows[0].binder_id])
      res.json({ ok: true })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.delete('/personal-binders/items/:itemId', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const itemId = positiveId(req.params.itemId)
      const owned = await client.query(
        `
        SELECT i.id, i.section_id, s.binder_id
        FROM personal_binder_items i
        INNER JOIN personal_binder_sections s ON s.id = i.section_id
        INNER JOIN personal_binders b ON b.id = s.binder_id
        WHERE i.id = $1 AND b.owner_user_id = $2 AND b.ga_id = $3 AND b.deleted_at IS NULL
        LIMIT 1
        `,
        [itemId, scope.userId, scope.gaId],
      )
      if (!itemId || owned.rowCount === 0) {
        res.status(404).json({ message: '바인더 자료를 찾을 수 없습니다.' })
        return
      }
      await client.query('BEGIN')
      await client.query(`DELETE FROM personal_binder_items WHERE id = $1`, [itemId])
      const remaining = await client.query(
        `SELECT id FROM personal_binder_items WHERE section_id = $1 ORDER BY sort_order, id`,
        [owned.rows[0].section_id],
      )
      await normalizeOrder(client, 'personal_binder_items', 'section_id', owned.rows[0].section_id, remaining.rows.map((row) => row.id))
      await client.query(`UPDATE personal_binders SET updated_at = NOW() WHERE id = $1`, [owned.rows[0].binder_id])
      await client.query('COMMIT')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      sendError(error, req, res, handleDbError)
    } finally {
      client.release()
    }
  })

  apiRouter.put('/personal-binders/sections/:sectionId/items/reorder', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const sectionId = positiveId(req.params.sectionId)
      const ids = Array.isArray(req.body?.itemIds) ? req.body.itemIds : []
      const section = sectionId ? await getOwnedSection(client, sectionId, scope) : null
      if (!section) {
        res.status(404).json({ message: '섹션을 찾을 수 없습니다.' })
        return
      }
      await client.query('BEGIN')
      await normalizeOrder(client, 'personal_binder_items', 'section_id', sectionId, ids)
      await client.query(`UPDATE personal_binders SET updated_at = NOW() WHERE id = $1`, [section.binder_id])
      await client.query('COMMIT')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      sendError(error, req, res, handleDbError)
    } finally {
      client.release()
    }
  })
}
