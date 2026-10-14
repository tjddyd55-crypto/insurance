import { r2DeleteObject } from '../lib/consentStorage.js'
import { readStorageFileBufferFromPath } from '../lib/storageFileObjectKey.js'
import { resolveNewsletterDetailLinkPreview } from '../lib/newsletterLinkPreview.js'
import { sqlFeedChannelExtraGuards } from '../lib/newsletterFeedChannelSql.js'
import { isInsurerManagerRole, isLossAdjusterRole } from '../lib/rbacScope.js'
import {
  buildNewsletterA4Pdf,
  validateNewsletterA4Pdf,
} from '../newsletter-collections/newsletterA4Pdf.js'
import {
  persistPersonalStoragePdf,
  registerBinderMaterialFromStorageFile,
} from '../personal-binder/binderMaterialRegister.js'
import { recordR2OrphanCleanupQueue } from '../personal-binder/personalBinderShareR2Compensation.js'
import { safeQuery } from '../utils/dbSafeQuery.js'

/**
 * 소식지 개인 폴더 · 즐겨찾기 · 내 바인더 가져오기 API.
 *
 * 격리 원칙
 *  - 모든 쿼리는 로그인 사용자 id + 소속 GA id 로만 범위를 정한다 (클라이언트 입력 GA 무시).
 *  - 소식지 노출 판정은 GA 원수사 소식지 피드(`/insurer-news/feed`)와 동일한 조건을 쓴다.
 *    삭제·비공개·다른 GA·고객용 소식은 폴더/즐겨찾기/가져오기 어디에서도 노출되지 않는다.
 *  - 원본 소식지/첨부는 읽기만 한다.
 */

const NAME_MAX = 80
const BULK_MAX = 50
const IMPORT_MAX = 20
const ATTACHMENT_TOTAL_MAX_BYTES = 60 * 1024 * 1024

/** 피드와 동일한 노출 조건 (alias n). $gaParam = GA id 파라미터 자리. */
function visibleNewsletterWhere(gaParam) {
  return `
    n.ga_id = ${gaParam}
    AND n.status = 'PUBLISHED'
    AND n.deleted_at IS NULL
    AND COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), 'INSURER') = 'INSURER'
    ${sqlFeedChannelExtraGuards('INSURER', 'n')}
    AND COALESCE((n.payload->>'customerVisible')::boolean, false) = false
    AND COALESCE(NULLIF(TRIM(n.payload->>'insurerSlug'), ''), '') <> 'customer-news'
    AND UPPER(COALESCE(NULLIF(TRIM(n.payload->>'insurerCode'), ''), '')) <> 'CUSTOMER_NEWS'
  `
}

function httpError(status, message) {
  return Object.assign(new Error(message), { httpStatus: status })
}

function requestScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  const gaId = Number(req.user?.gaId)
  if (!userId || !Number.isInteger(gaId) || gaId < 1) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  if (isInsurerManagerRole(req.user?.role) || isLossAdjusterRole(req.user?.role)) {
    res.status(403).json({ message: '채널 담당자 계정은 이용할 수 없습니다.' })
    return null
  }
  return { userId, gaId }
}

function positiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function normalizeName(value) {
  const name = String(value ?? '').trim().slice(0, NAME_MAX)
  return name || null
}

function normalizeNewsletterIds(value, max) {
  if (!Array.isArray(value)) return []
  const out = []
  const seen = new Set()
  for (const raw of value) {
    const id = String(raw ?? '').trim()
    if (!id || id.length > 64 || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= max) break
  }
  return out
}

async function filterVisibleNewsletterIds(executor, scope, ids) {
  if (ids.length === 0) return new Set()
  const r = await safeQuery(
    executor,
    `SELECT n.id FROM insurance_company_newsletters n WHERE n.id = ANY($2::text[]) AND ${visibleNewsletterWhere('$1')}`,
    [scope.gaId, ids],
  )
  return new Set(r.rows.map((row) => String(row.id)))
}

async function getOwnedFolder(executor, scope, folderId) {
  const r = await safeQuery(
    executor,
    `SELECT id, name, created_at, updated_at FROM newsletter_user_folders WHERE id = $1 AND user_id = $2 AND ga_id = $3`,
    [folderId, scope.userId, scope.gaId],
  )
  return r.rows[0] ?? null
}

function mapFolder(row, newsletterIds = []) {
  return {
    id: String(row.id),
    name: row.name,
    count: newsletterIds.length,
    newsletterIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadCollections(executor, scope) {
  const folders = await safeQuery(
    executor,
    `
    SELECT id, name, created_at, updated_at
    FROM newsletter_user_folders
    WHERE user_id = $1 AND ga_id = $2
    ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
    [scope.userId, scope.gaId],
  )
  const items = await safeQuery(
    executor,
    `
    SELECT i.folder_id, i.newsletter_id
    FROM newsletter_user_folder_items i
    INNER JOIN newsletter_user_folders f ON f.id = i.folder_id AND f.user_id = $1 AND f.ga_id = $2
    INNER JOIN insurance_company_newsletters n ON n.id = i.newsletter_id
    WHERE ${visibleNewsletterWhere('$2')}
    ORDER BY i.created_at DESC
    `,
    [scope.userId, scope.gaId],
  )
  const favorites = await safeQuery(
    executor,
    `
    SELECT fav.newsletter_id
    FROM newsletter_user_favorites fav
    INNER JOIN insurance_company_newsletters n ON n.id = fav.newsletter_id
    WHERE fav.user_id = $1 AND fav.ga_id = $2 AND ${visibleNewsletterWhere('$2')}
    ORDER BY fav.created_at DESC
    `,
    [scope.userId, scope.gaId],
  )
  const byFolder = new Map()
  for (const row of items.rows) {
    const key = String(row.folder_id)
    if (!byFolder.has(key)) byFolder.set(key, [])
    byFolder.get(key).push(String(row.newsletter_id))
  }
  return {
    folders: folders.rows.map((row) => mapFolder(row, byFolder.get(String(row.id)) ?? [])),
    favoriteNewsletterIds: favorites.rows.map((row) => String(row.newsletter_id)),
  }
}

/* ───────────────────────── 바인더 가져오기 ───────────────────────── */

async function getOwnedSection(executor, sectionId, scope) {
  const r = await safeQuery(
    executor,
    `
    SELECT s.id, s.binder_id
    FROM personal_binder_sections s
    INNER JOIN personal_binders b ON b.id = s.binder_id
    WHERE s.id = $1 AND b.owner_user_id = $2 AND b.ga_id = $3 AND b.deleted_at IS NULL
    LIMIT 1
    `,
    [sectionId, scope.userId, scope.gaId],
  )
  return r.rows[0] ?? null
}

async function loadVisibleNewsletterForImport(executor, scope, newsletterId) {
  const n = await safeQuery(
    executor,
    `SELECT n.* FROM insurance_company_newsletters n WHERE n.id = $2 AND ${visibleNewsletterWhere('$1')} LIMIT 1`,
    [scope.gaId, newsletterId],
  )
  if (n.rowCount === 0) return null
  const att = await safeQuery(
    executor,
    `
    SELECT a.*
    FROM insurance_company_newsletter_attachments a
    INNER JOIN insurance_company_newsletters n ON n.id = a.newsletter_id AND n.ga_id = $2
    WHERE a.newsletter_id = $1
    ORDER BY a.sort_order ASC
    `,
    [newsletterId, scope.gaId],
  )
  return { row: n.rows[0], attachments: att.rows }
}

function newsletterSourceRef(row) {
  const stamp = new Date(row.updated_at ?? row.created_at ?? 0).getTime()
  return `newsletter:${row.id}:${Number.isFinite(stamp) ? stamp : 0}`
}

function newsletterDisplayTitle(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const title = String(row.title ?? '').trim()
  const summary = String(payload.summary ?? row.body_text ?? '').trim().split('\n')[0]
  const base = (title || summary || '소식지').slice(0, 120)
  const company = String(row.company_name_snapshot ?? payload.insurerName ?? '').trim()
  return (company ? `[${company}] ${base}` : base).slice(0, 200)
}

/** 첨부는 DB 에 저장된 R2 object key 로만 읽는다 (외부 URL 요청 없음 → SSRF 없음). */
async function readAttachmentBuffers(attachments) {
  let total = 0
  const out = []
  for (const row of attachments) {
    const key = String(row.object_key ?? '').trim()
    if (!key || /^https?:/i.test(key)) {
      out.push({ row, buffer: null })
      continue
    }
    try {
      const buffer = await readStorageFileBufferFromPath(key)
      total += buffer.length
      if (total > ATTACHMENT_TOTAL_MAX_BYTES) {
        throw httpError(422, '첨부 용량이 너무 커서 PDF로 변환할 수 없습니다.')
      }
      out.push({ row, buffer })
    } catch (error) {
      if (error?.httpStatus) throw error
      out.push({ row, buffer: null })
    }
  }
  return out
}

/** 새로 만든 내 파일(files 행 + R2 객체 + 용량)을 되돌린다. R2 삭제 실패 시 정리 큐에 남긴다. */
async function compensateStoredFile(pool, scope, fileRow) {
  if (!fileRow) return
  const fileId = Number(fileRow.id)
  const size = Number(fileRow.file_size) || 0
  const key = String(fileRow.file_path ?? '').trim()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const del = await client.query(`DELETE FROM files WHERE id = $1 AND user_id = $2 AND ga_id = $3`, [
      fileId,
      scope.userId,
      scope.gaId,
    ])
    if (del.rowCount > 0 && size > 0) {
      await client.query(
        `UPDATE users SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2 AND ga_id = $3`,
        [size, scope.userId, scope.gaId],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[newsletter-binder-import] file rollback failed', { fileId, message: error?.message })
  } finally {
    client.release()
  }
  if (!key) return
  try {
    await r2DeleteObject(key)
  } catch (error) {
    await recordR2OrphanCleanupQueue(pool, {
      objectKeys: [key],
      reason: 'newsletter_binder_import_rollback',
      userId: scope.userId,
      gaId: scope.gaId,
    }).catch(() => {})
    console.error('[newsletter-binder-import] r2 rollback queued', { fileId, message: error?.message })
  }
}

async function addSectionItem(pool, section, materialId, scope) {
  const existing = await safeQuery(
    pool,
    `
    SELECT i.id
    FROM personal_binder_items i
    INNER JOIN personal_binder_sections s ON s.id = i.section_id
    INNER JOIN personal_binders b ON b.id = s.binder_id
    WHERE i.section_id = $1 AND i.material_id = $2
      AND b.owner_user_id = $3 AND b.ga_id = $4 AND b.deleted_at IS NULL
    LIMIT 1
    `,
    [section.id, materialId, scope.userId, scope.gaId],
  )
  if (existing.rowCount > 0) return { id: String(existing.rows[0].id), existing: true }
  // personalBinderApi 와 동일하게 pool.query 사용 (items 테이블에 ga_id 컬럼 없음).
  const result = await pool.query(
    `
    INSERT INTO personal_binder_items (section_id, material_id, sort_order, page_selection)
    SELECT $1, $2, COALESCE(MAX(sort_order), -1) + 1, NULL
    FROM personal_binder_items WHERE section_id = $1
    RETURNING id
    `,
    [section.id, materialId],
  )
  await pool.query(
    `UPDATE personal_binders SET updated_at = NOW() WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3`,
    [section.binder_id, scope.userId, scope.gaId],
  )
  return { id: String(result.rows[0].id), existing: false }
}

async function importOneNewsletter(pool, scope, gaCode, section, newsletterId) {
  const loaded = await loadVisibleNewsletterForImport(pool, scope, newsletterId)
  if (!loaded) throw httpError(404, '소식지를 찾을 수 없거나 볼 권한이 없습니다.')
  const { row } = loaded
  const sourceRef = newsletterSourceRef(row)
  const title = newsletterDisplayTitle(row)

  // 같은 소식지(같은 수정 시점)를 이미 변환해 둔 자료가 있으면 그 스냅샷을 재사용한다.
  const reuse = await safeQuery(
    pool,
    `
    SELECT id FROM personal_binder_materials
    WHERE owner_user_id = $1 AND ga_id = $2 AND source_ref = $3 AND deleted_at IS NULL
    ORDER BY id DESC LIMIT 1
    `,
    [scope.userId, scope.gaId, sourceRef],
  )
  if (reuse.rowCount > 0) {
    const materialId = Number(reuse.rows[0].id)
    const item = await addSectionItem(pool, section, materialId, scope)
    return { materialId: String(materialId), itemId: item.id, existing: item.existing, reusedMaterial: true, warnings: [] }
  }

  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const attachments = await readAttachmentBuffers(loaded.attachments)
  const built = await buildNewsletterA4Pdf({
    newsletter: {
      title: String(row.title ?? '').trim(),
      summary: String(payload.summary ?? '').trim(),
      bodyText: String(row.body_text ?? ''),
      insurerName: String(row.company_name_snapshot ?? payload.insurerName ?? '').trim(),
      publishedAt: payload.publishedAt ?? row.created_at,
    },
    linkPreview: resolveNewsletterDetailLinkPreview(row),
    attachments,
  })
  await validateNewsletterA4Pdf(built.buffer)

  const fileName = `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || '소식지'}.pdf`
  const fileRow = await persistPersonalStoragePdf(pool, scope, gaCode, built.buffer, fileName)
  let materialId = null
  let createdMaterial = false
  try {
    const registered = await registerBinderMaterialFromStorageFile(pool, scope, fileRow, {
      title,
      folderId: null,
      sourceType: 'personal',
      sourceRef,
    })
    materialId = Number(registered.row.id)
    createdMaterial = !registered.reused
    if (registered.reused) {
      // 체크섬이 같은 기존 자료가 있으면 새 파일은 필요 없다.
      await compensateStoredFile(pool, scope, fileRow)
    }
    const item = await addSectionItem(pool, section, materialId, scope)
    return {
      materialId: String(materialId),
      itemId: item.id,
      existing: item.existing,
      reusedMaterial: !createdMaterial,
      pageCount: built.pageCount,
      warnings: built.warnings,
    }
  } catch (error) {
    if (createdMaterial && materialId) {
      await pool
        .query(`DELETE FROM personal_binder_materials WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3`, [
          materialId,
          scope.userId,
          scope.gaId,
        ])
        .catch(() => {})
    }
    if (createdMaterial || !materialId) {
      await compensateStoredFile(pool, scope, fileRow)
    }
    throw error
  }
}

/* ───────────────────────── routes ───────────────────────── */

export function registerNewsletterCollectionsApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx
  const importLocks = new Set()

  const fail = (error, req, res) => {
    if (error?.httpStatus) {
      res.status(error.httpStatus).json({ message: error.message })
      return
    }
    handleDbError(error, req, res)
  }

  apiRouter.get('/newsletter-collections', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      res.json(await loadCollections(pool, scope))
    } catch (error) {
      fail(error, req, res)
    }
  })

  apiRouter.post('/newsletter-collections/folders', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const name = normalizeName(req.body?.name)
      if (!name) {
        res.status(400).json({ message: '폴더 이름을 입력해 주세요.' })
        return
      }
      const r = await safeQuery(
        pool,
        `
        INSERT INTO newsletter_user_folders (user_id, ga_id, name, sort_order)
        SELECT $1, $2, $3, COALESCE(MAX(sort_order), -1) + 1
        FROM newsletter_user_folders WHERE user_id = $1 AND ga_id = $2
        RETURNING id, name, created_at, updated_at
        `,
        [scope.userId, scope.gaId, name],
      )
      res.status(201).json(mapFolder(r.rows[0]))
    } catch (error) {
      fail(error, req, res)
    }
  })

  apiRouter.patch('/newsletter-collections/folders/:folderId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const folderId = positiveId(req.params.folderId)
      const name = normalizeName(req.body?.name)
      if (!folderId || !name) {
        res.status(400).json({ message: '폴더 이름을 입력해 주세요.' })
        return
      }
      const r = await safeQuery(
        pool,
        `
        UPDATE newsletter_user_folders SET name = $4, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND ga_id = $3
        RETURNING id, name, created_at, updated_at
        `,
        [folderId, scope.userId, scope.gaId, name],
      )
      if (r.rowCount === 0) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
      res.json(mapFolder(r.rows[0]))
    } catch (error) {
      fail(error, req, res)
    }
  })

  apiRouter.delete('/newsletter-collections/folders/:folderId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const folderId = positiveId(req.params.folderId)
      // 폴더와 연결(newsletter_user_folder_items, CASCADE)만 지운다. 원본 소식지는 그대로.
      const r = folderId
        ? await safeQuery(
            pool,
            `DELETE FROM newsletter_user_folders WHERE id = $1 AND user_id = $2 AND ga_id = $3`,
            [folderId, scope.userId, scope.gaId],
          )
        : { rowCount: 0 }
      if (r.rowCount === 0) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
      res.json({ ok: true })
    } catch (error) {
      fail(error, req, res)
    }
  })

  apiRouter.post('/newsletter-collections/folders/:folderId/items', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const folderId = positiveId(req.params.folderId)
      const folder = folderId ? await getOwnedFolder(pool, scope, folderId) : null
      if (!folder) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
      const ids = normalizeNewsletterIds(req.body?.newsletterIds, BULK_MAX)
      if (ids.length === 0) {
        res.status(400).json({ message: '담을 소식지를 선택해 주세요.' })
        return
      }
      const visible = await filterVisibleNewsletterIds(pool, scope, ids)
      const allowed = ids.filter((id) => visible.has(id))
      const inserted = allowed.length
        ? await safeQuery(
            pool,
            `
            INSERT INTO newsletter_user_folder_items (folder_id, newsletter_id)
            SELECT f.id, x
            FROM newsletter_user_folders f
            CROSS JOIN unnest($3::text[]) AS x
            WHERE f.id = $1 AND f.user_id = $2 AND f.ga_id = $4
            ON CONFLICT (folder_id, newsletter_id) DO NOTHING
            RETURNING newsletter_id
            `,
            [folderId, scope.userId, allowed, scope.gaId],
          )
        : { rows: [] }
      const addedSet = new Set(inserted.rows.map((row) => String(row.newsletter_id)))
      await safeQuery(pool, `UPDATE newsletter_user_folders SET updated_at = NOW() WHERE id = $1 AND user_id = $2 AND ga_id = $3`, [folderId, scope.userId, scope.gaId])
      res.json({
        added: [...addedSet],
        duplicates: allowed.filter((id) => !addedSet.has(id)),
        rejected: ids.filter((id) => !visible.has(id)),
      })
    } catch (error) {
      fail(error, req, res)
    }
  })

  apiRouter.delete('/newsletter-collections/folders/:folderId/items/:newsletterId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const folderId = positiveId(req.params.folderId)
      const folder = folderId ? await getOwnedFolder(pool, scope, folderId) : null
      if (!folder) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
      await safeQuery(
        pool,
        `
        DELETE FROM newsletter_user_folder_items i
        USING newsletter_user_folders f
        WHERE i.folder_id = f.id
          AND f.id = $1 AND f.user_id = $2 AND f.ga_id = $3
          AND i.newsletter_id = $4
        `,
        [folderId, scope.userId, scope.gaId, String(req.params.newsletterId ?? '')],
      )
      res.json({ ok: true })
    } catch (error) {
      fail(error, req, res)
    }
  })

  apiRouter.put('/newsletter-collections/favorites/:newsletterId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const id = String(req.params.newsletterId ?? '').trim()
      const visible = await filterVisibleNewsletterIds(pool, scope, id ? [id] : [])
      if (!visible.has(id)) {
        res.status(404).json({ message: '소식지를 찾을 수 없습니다.' })
        return
      }
      await safeQuery(
        pool,
        `
        INSERT INTO newsletter_user_favorites (user_id, ga_id, newsletter_id)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
        `,
        [scope.userId, scope.gaId, id],
      )
      res.json({ favorite: true })
    } catch (error) {
      fail(error, req, res)
    }
  })

  apiRouter.delete('/newsletter-collections/favorites/:newsletterId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      await safeQuery(
        pool,
        `DELETE FROM newsletter_user_favorites WHERE user_id = $1 AND ga_id = $2 AND newsletter_id = $3`,
        [scope.userId, scope.gaId, String(req.params.newsletterId ?? '')],
      )
      res.json({ favorite: false })
    } catch (error) {
      fail(error, req, res)
    }
  })

  /**
   * 소식지 → A4 PDF → 내 파일(R2 + 용량) → 바인더 자료 → 섹션 항목.
   * 기존 바인더 자료 등록 경로(persistPersonalStoragePdf / registerBinderMaterialFromStorageFile)를 그대로 쓴다.
   * 항목별로 성공/실패를 돌려준다 (부분 등록 없음: 실패한 항목은 파일·자료까지 되돌린다).
   */
  apiRouter.post('/newsletter-collections/binder-import', requireAuth, async (req, res) => {
    const scope = requestScope(req, res)
    if (!scope) return
    const lockKey = `${scope.userId}:${scope.gaId}`
    if (importLocks.has(lockKey)) {
      res.status(409).json({ message: '이미 바인더로 가져오는 중입니다. 잠시 후 다시 시도해 주세요.' })
      return
    }
    importLocks.add(lockKey)
    try {
      const sectionId = positiveId(req.body?.sectionId)
      const section = sectionId ? await getOwnedSection(pool, sectionId, scope) : null
      if (!section) {
        res.status(404).json({ message: '바인더 섹션을 찾을 수 없습니다.' })
        return
      }
      const ids = normalizeNewsletterIds(req.body?.newsletterIds, IMPORT_MAX + 1)
      if (ids.length === 0) {
        res.status(400).json({ message: '가져올 소식지를 선택해 주세요.' })
        return
      }
      if (ids.length > IMPORT_MAX) {
        res.status(400).json({ message: `한 번에 ${IMPORT_MAX}개까지 가져올 수 있습니다.` })
        return
      }
      const gaCode = String(req.user?.gaCode ?? scope.gaId)
      const results = []
      for (const newsletterId of ids) {
        try {
          const r = await importOneNewsletter(pool, scope, gaCode, section, newsletterId)
          results.push({ newsletterId, ok: true, ...r })
        } catch (error) {
          if (!error?.httpStatus) {
            console.error('[newsletter-binder-import] failed', { newsletterId, message: error?.message })
          }
          results.push({
            newsletterId,
            ok: false,
            message: error?.httpStatus ? error.message : 'PDF로 변환해 바인더에 담지 못했습니다.',
          })
        }
      }
      res.json({
        sectionId: String(section.id),
        binderId: String(section.binder_id),
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      })
    } catch (error) {
      fail(error, req, res)
    } finally {
      importLocks.delete(lockKey)
    }
  })
}
