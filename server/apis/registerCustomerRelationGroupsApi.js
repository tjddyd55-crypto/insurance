import { parseGaId } from '../lib/parseGaId.js'
import { assertCustomerRowAccessibleByVisibility } from '../lib/customerRowVisibilitySql.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  addRelationGroupMember,
  createRelationGroup,
  listRelationGroupsForCustomer,
  removeRelationGroupMember,
  softDeleteRelationGroup,
  updateRelationGroup,
  updateRelationGroupMemberLabel,
} from '../customer-relation-groups/customerRelationGroupsService.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} ctx
 */
export function registerCustomerRelationGroupsApi(apiRouter, { pool, requireAuth, handleDbError }) {
  async function assertCustomerActiveOwned(req, customerId) {
    return assertCustomerRowAccessibleByVisibility(pool, safeQuery, req, customerId, {
      requireNonDeleted: true,
    })
  }

  function requireUserGa(req, res) {
    const userId = req.user?.id ? String(req.user.id) : ''
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return null
    }
    const gaId = parseGaId(req.gaId ?? req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return null
    }
    return { userId, gaId }
  }

  function parsePositiveInt(raw) {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) {
      return null
    }
    return n
  }

  apiRouter.get('/customers/:id/relation-groups', requireAuth, async (req, res) => {
    try {
      const scope = requireUserGa(req, res)
      if (!scope) return
      const customerId = parsePositiveInt(req.params.id)
      if (customerId == null) {
        res.status(400).json({ message: '잘못된 고객 ID입니다.' })
        return
      }
      if (!(await assertCustomerActiveOwned(req, customerId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      const data = await listRelationGroupsForCustomer(pool, {
        customerId,
        userId: scope.userId,
        gaId: scope.gaId,
      })
      res.json({ success: true, data })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:id/relation-groups', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const scope = requireUserGa(req, res)
      if (!scope) return
      const customerId = parsePositiveInt(req.params.id)
      if (customerId == null) {
        res.status(400).json({ message: '잘못된 고객 ID입니다.' })
        return
      }
      if (!(await assertCustomerActiveOwned(req, customerId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }

      const rawMembers = Array.isArray(req.body?.members) ? req.body.members : []
      /** @type {Array<{ customerId: number, relationshipLabel?: string }>} */
      const members = []
      for (const item of rawMembers) {
        const id = parsePositiveInt(item?.customerId ?? item?.customer_id)
        if (id == null || id === customerId) continue
        if (!(await assertCustomerActiveOwned(req, id))) {
          res.status(404).json({ message: '추가할 고객을 찾을 수 없습니다.' })
          return
        }
        members.push({
          customerId: id,
          relationshipLabel: item?.relationshipLabel ?? item?.relationship_label,
        })
      }

      await client.query('BEGIN')
      const result = await createRelationGroup(client, {
        customerId,
        userId: scope.userId,
        gaId: scope.gaId,
        name: req.body?.name,
        groupType: req.body?.groupType ?? req.body?.group_type,
        memo: req.body?.memo,
        members,
      })
      if (!result.ok) {
        await client.query('ROLLBACK')
        res.status(result.status || 400).json({
          success: false,
          message: result.message,
          code: result.code,
          data: result.data,
        })
        return
      }
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: result.data })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.patch('/customer-relation-groups/:groupId', requireAuth, async (req, res) => {
    try {
      const scope = requireUserGa(req, res)
      if (!scope) return
      const groupId = parsePositiveInt(req.params.groupId)
      if (groupId == null) {
        res.status(400).json({ message: '잘못된 그룹 ID입니다.' })
        return
      }
      const result = await updateRelationGroup(pool, {
        groupId,
        userId: scope.userId,
        gaId: scope.gaId,
        name: req.body?.name,
        groupType: req.body?.groupType ?? req.body?.group_type,
        memo: req.body?.memo,
      })
      if (!result.ok) {
        res.status(result.status || 400).json({ success: false, message: result.message })
        return
      }
      res.json({ success: true, data: result.data })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customer-relation-groups/:groupId/members', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const scope = requireUserGa(req, res)
      if (!scope) return
      const groupId = parsePositiveInt(req.params.groupId)
      if (groupId == null) {
        res.status(400).json({ message: '잘못된 그룹 ID입니다.' })
        return
      }
      const customerId = parsePositiveInt(req.body?.customerId ?? req.body?.customer_id)
      if (customerId == null) {
        res.status(400).json({ message: '고객 ID가 올바르지 않습니다.' })
        return
      }
      if (!(await assertCustomerActiveOwned(req, customerId))) {
        res.status(404).json({ message: '추가할 고객을 찾을 수 없습니다.' })
        return
      }

      await client.query('BEGIN')
      const result = await addRelationGroupMember(client, {
        groupId,
        userId: scope.userId,
        gaId: scope.gaId,
        customerId,
        relationshipLabel: req.body?.relationshipLabel ?? req.body?.relationship_label,
      })
      if (!result.ok) {
        await client.query('ROLLBACK')
        res.status(result.status || 400).json({
          success: false,
          message: result.message,
          code: result.code,
          data: result.data,
        })
        return
      }
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: { ok: true } })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.patch(
    '/customer-relation-groups/:groupId/members/:customerId',
    requireAuth,
    async (req, res) => {
      try {
        const scope = requireUserGa(req, res)
        if (!scope) return
        const groupId = parsePositiveInt(req.params.groupId)
        const customerId = parsePositiveInt(req.params.customerId)
        if (groupId == null || customerId == null) {
          res.status(400).json({ message: '잘못된 요청입니다.' })
          return
        }
        const result = await updateRelationGroupMemberLabel(pool, {
          groupId,
          userId: scope.userId,
          gaId: scope.gaId,
          customerId,
          relationshipLabel: req.body?.relationshipLabel ?? req.body?.relationship_label,
        })
        if (!result.ok) {
          res.status(result.status || 400).json({ success: false, message: result.message })
          return
        }
        res.json({ success: true, data: result.data })
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )

  apiRouter.delete(
    '/customer-relation-groups/:groupId/members/:customerId',
    requireAuth,
    async (req, res) => {
      const client = await pool.connect()
      try {
        const scope = requireUserGa(req, res)
        if (!scope) return
        const groupId = parsePositiveInt(req.params.groupId)
        const customerId = parsePositiveInt(req.params.customerId)
        if (groupId == null || customerId == null) {
          res.status(400).json({ message: '잘못된 요청입니다.' })
          return
        }
        await client.query('BEGIN')
        const result = await removeRelationGroupMember(client, {
          groupId,
          userId: scope.userId,
          gaId: scope.gaId,
          customerId,
        })
        if (!result.ok) {
          await client.query('ROLLBACK')
          res.status(result.status || 400).json({ success: false, message: result.message })
          return
        }
        await client.query('COMMIT')
        res.json({ success: true, data: result.data })
      } catch (error) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* ignore */
        }
        handleDbError(error, req, res)
      } finally {
        client.release()
      }
    },
  )

  apiRouter.delete('/customer-relation-groups/:groupId', requireAuth, async (req, res) => {
    try {
      const scope = requireUserGa(req, res)
      if (!scope) return
      const groupId = parsePositiveInt(req.params.groupId)
      if (groupId == null) {
        res.status(400).json({ message: '잘못된 그룹 ID입니다.' })
        return
      }
      const result = await softDeleteRelationGroup(pool, {
        groupId,
        userId: scope.userId,
        gaId: scope.gaId,
      })
      if (!result.ok) {
        res.status(result.status || 400).json({ success: false, message: result.message })
        return
      }
      res.json({ success: true, data: { ok: true } })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
