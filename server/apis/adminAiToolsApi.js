import { getDatabaseCatalog } from '../ai-assistant/data-catalog/databaseCatalogService.js'
import { auditSemanticCatalogAgainstDatabaseCatalog } from '../ai-assistant/data-catalog/semanticCatalogAudit.js'
import { listAiSemanticFields, summarizeAiSemanticCatalog } from '../../shared/ai-assistant/semanticDataCatalog.js'
import {
  listAiImprovements,
  updateAiImprovementStatus,
} from '../ai-assistant/improvement/improvementService.js'
import {
  AI_TOOL_REGISTRY_UPDATED_AT,
  AI_TOOL_REGISTRY_VERSION,
  listAiToolCategories,
  loadAiToolRegistry,
  summarizeAiToolRegistry,
  summarizeAiToolRegistryByCategory,
} from '../../shared/ai-assistant/registry.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.requireSuperAdmin
 */
export function registerAdminAiToolsApi(apiRouter, ctx) {
  const { requireAuth, requireSuperAdmin, pool } = ctx

  apiRouter.get('/admin/ai-tools', requireAuth, requireSuperAdmin, (req, res) => {
    const tools = loadAiToolRegistry()
    res.json({
      registryVersion: AI_TOOL_REGISTRY_VERSION,
      registryUpdatedAt: AI_TOOL_REGISTRY_UPDATED_AT,
      categories: listAiToolCategories(),
      summary: summarizeAiToolRegistry(tools),
      summaryByCategory: summarizeAiToolRegistryByCategory(tools),
      tools,
    })
  })

  apiRouter.get('/admin/ai-improvements', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const items = await listAiImprovements(pool, {
        status: req.query?.status,
        issueType: req.query?.issueType,
      })
      res.json({ items })
    } catch (error) {
      res.status(Number(error?.status) || 500).json({
        code: error?.code ?? 'AI_IMPROVEMENT_LIST_FAILED',
        message: error instanceof Error ? error.message : 'AI 개선 목록 조회 실패',
      })
    }
  })

  apiRouter.patch('/admin/ai-improvements/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const item = await updateAiImprovementStatus(pool, req.params.id, req.body?.status)
      res.json({ item })
    } catch (error) {
      res.status(Number(error?.status) || 400).json({
        code: error?.code ?? 'AI_IMPROVEMENT_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'AI 개선 상태 변경 실패',
      })
    }
  })


  apiRouter.get('/admin/ai-semantic-catalog', requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const databaseCatalog = await getDatabaseCatalog(pool)
      const audit = auditSemanticCatalogAgainstDatabaseCatalog(databaseCatalog)
      res.json({
        summary: summarizeAiSemanticCatalog(),
        fields: listAiSemanticFields(),
        audit,
      })
    } catch (error) {
      res.status(500).json({
        code: 'AI_SEMANTIC_CATALOG_FAILED',
        message: error instanceof Error ? error.message : 'AI 의미 사전 조회 실패',
      })
    }
  })

  apiRouter.get('/admin/ai-data-catalog', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const catalog = await getDatabaseCatalog(pool, { force: req.query?.refresh === '1' })
      const semanticAudit = auditSemanticCatalogAgainstDatabaseCatalog(catalog)
      res.json({
        ...catalog,
        semanticAudit,
      })
    } catch (error) {
      res.status(500).json({
        code: 'AI_DATA_CATALOG_FAILED',
        message: error instanceof Error ? error.message : 'DB 정의 조회 실패',
      })
    }
  })
}
