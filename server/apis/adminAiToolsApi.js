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
  const { requireAuth, requireSuperAdmin } = ctx

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
}
