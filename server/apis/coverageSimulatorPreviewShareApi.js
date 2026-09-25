import express from 'express'

import {
  isCoveragePreviewShareApiEnabled,
  resolvePreviewShareOwnerFromEnv,
} from '../coverage-simulator/coveragePreviewShareConfig.js'
import {
  attachCoverageSharePdf,
  buildCoverageSharePageUrl,
  createCoverageSimulationShare,
  listCoverageSimulationShares,
  revokeCoverageSimulationShare,
} from '../coverage-simulator/coverageSimulationShareService.js'

const pdfUpload = express.raw({ type: 'application/pdf', limit: '16mb' })

/**
 * DEV / non-production Preview Share — 로그인 없이 QA용. Production route 등록 금지.
 */
export function registerCoverageSimulatorPreviewShareApi(apiRouter, ctx) {
  if (!isCoveragePreviewShareApiEnabled()) {
    return
  }

  const { pool, handleDbError } = ctx
  const owner = resolvePreviewShareOwnerFromEnv()

  apiRouter.post('/dev/coverage-simulator/preview-shares/:consultationId', async (req, res) => {
    try {
      if (!owner) {
        res.status(503).json({
          message: 'Preview share가 서버에 설정되지 않았습니다. COVERAGE_PREVIEW_SHARE_GA_ID / USER_ID를 확인하세요.',
        })
        return
      }
      const consultationId = String(req.params.consultationId ?? '').trim()
      const scenario = req.body?.scenario
      const row = await createCoverageSimulationShare(pool, {
        gaId: owner.gaId,
        userId: owner.userId,
        consultationId,
        scenario,
      })
      const shareUrl = buildCoverageSharePageUrl(req, row.share_token)
      res.status(201).json({
        shareId: String(row.id),
        shareUrl,
        createdAt: row.created_at,
        expiresAt: null,
        pdfReady: Boolean(row.pdf_object_key),
      })
    } catch (error) {
      if (error?.httpStatus) {
        res.status(error.httpStatus).json({ message: error.message })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/dev/coverage-simulator/preview-shares/:consultationId', async (req, res) => {
    try {
      if (!owner) {
        res.status(503).json({ message: 'Preview share가 설정되지 않았습니다.' })
        return
      }
      const consultationId = String(req.params.consultationId ?? '').trim()
      const rows = await listCoverageSimulationShares(pool, owner.gaId, owner.userId, consultationId)
      res.json({
        shares: rows.map((row) => ({
          shareId: String(row.id),
          title: row.title_snapshot,
          createdAt: row.created_at,
          revokedAt: row.revoked_at,
          lastViewedAt: row.last_viewed_at,
          viewCount: row.view_count,
          pdfReady: Boolean(row.pdf_object_key),
          shareUrl: row.revoked_at ? null : buildCoverageSharePageUrl(req, row.share_token),
        })),
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/dev/coverage-simulator/preview-shares/:shareId/revoke', async (req, res) => {
    try {
      if (!owner) {
        res.status(503).json({ message: 'Preview share가 설정되지 않았습니다.' })
        return
      }
      const shareId = Number(req.params.shareId)
      if (!Number.isFinite(shareId)) {
        res.status(400).json({ message: 'shareId가 올바르지 않습니다.' })
        return
      }
      const ok = await revokeCoverageSimulationShare(pool, owner.gaId, owner.userId, shareId)
      if (!ok) {
        res.status(404).json({ message: '공유 자료를 찾을 수 없습니다.' })
        return
      }
      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.put('/dev/coverage-simulator/preview-shares/:shareId/pdf', pdfUpload, async (req, res) => {
    try {
      if (!owner) {
        res.status(503).json({ message: 'Preview share가 설정되지 않았습니다.' })
        return
      }
      const shareId = Number(req.params.shareId)
      if (!Number.isFinite(shareId)) {
        res.status(400).json({ message: 'shareId가 올바르지 않습니다.' })
        return
      }
      await attachCoverageSharePdf(pool, owner.gaId, owner.userId, shareId, req.body)
      res.json({ ok: true, pdfReady: true })
    } catch (error) {
      if (error?.httpStatus) {
        res.status(error.httpStatus).json({ message: error.message })
        return
      }
      handleDbError(error, req, res)
    }
  })
}
