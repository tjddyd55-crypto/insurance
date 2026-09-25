import express from 'express'

import {
  attachCoverageSharePdf,
  buildCoverageSharePageUrl,
  createCoverageSimulationShare,
  getPublicCoverageShareByToken,
  listCoverageSimulationShares,
  loadCoverageSharePdfBuffer,
  maskShareTokenForLog,
  resolveShareOwnerContext,
  revokeCoverageSimulationShare,
  toPublicViewerPayload,
} from '../coverage-simulator/coverageSimulationShareService.js'
import { buildCoveragePdfFileNameFromScenario } from '../coverage-simulator/coverageSharePdfFileName.js'

const pdfUpload = express.raw({ type: 'application/pdf', limit: '16mb' })

function sendShareError(res, status) {
  if (status === 'not_found') {
    res.status(404).json({ code: 'NOT_FOUND', message: '공유 자료를 찾을 수 없습니다.' })
    return
  }
  if (status === 'revoked') {
    res.status(410).json({ code: 'REVOKED', message: '공유가 중지된 자료입니다.' })
    return
  }
  if (status === 'expired') {
    res.status(410).json({ code: 'EXPIRED', message: '공유 기간이 만료된 자료입니다.' })
    return
  }
  res.status(404).json({ code: 'NOT_FOUND', message: '공유 자료를 찾을 수 없습니다.' })
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} ctx
 */
export function registerCoverageSimulatorShareApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.post('/coverage-simulator/consultations/:consultationId/shares', requireAuth, async (req, res) => {
    try {
      const owner = resolveShareOwnerContext(req, res)
      if (!owner) return
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

  apiRouter.get('/coverage-simulator/consultations/:consultationId/shares', requireAuth, async (req, res) => {
    try {
      const owner = resolveShareOwnerContext(req, res)
      if (!owner) return
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

  apiRouter.post('/coverage-simulator/shares/:shareId/revoke', requireAuth, async (req, res) => {
    try {
      const owner = resolveShareOwnerContext(req, res)
      if (!owner) return
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

  apiRouter.put('/coverage-simulator/shares/:shareId/pdf', requireAuth, pdfUpload, async (req, res) => {
    try {
      const owner = resolveShareOwnerContext(req, res)
      if (!owner) return
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

  apiRouter.get('/public/coverage-shares/:token', async (req, res) => {
    try {
      const token = String(req.params.token ?? '').trim()
      const resolved = await getPublicCoverageShareByToken(pool, token, { recordView: true })
      if (resolved.status !== 'ok') {
        sendShareError(res, resolved.status)
        return
      }
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      res.json(toPublicViewerPayload(resolved.row))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/public/coverage-shares/:token/pdf', async (req, res) => {
    try {
      const token = String(req.params.token ?? '').trim()
      const resolved = await loadCoverageSharePdfBuffer(pool, token)
      if (resolved.status !== 'ok') {
        if (resolved.status === 'pdf_missing') {
          res.status(404).json({ code: 'PDF_NOT_READY', message: 'PDF가 아직 준비되지 않았습니다.' })
          return
        }
        sendShareError(res, resolved.status)
        return
      }
      const fileName = buildCoveragePdfFileNameFromScenario(resolved.row.scenario_snapshot)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      res.send(resolved.buffer)
    } catch (error) {
      console.error('[coverage share pdf]', { token: maskShareTokenForLog(req.params.token) })
      handleDbError(error, req, res)
    }
  })
}
