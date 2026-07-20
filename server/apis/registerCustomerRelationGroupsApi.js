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
 * 내부 DB/가드 오류를 안전한 사용자 메시지로 매핑한다.
 * PostgreSQL 원문·테이블명·SQL 은 응답에 넣지 않는다.
 * @param {unknown} error
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} _handleDbError
 * @param {'create' | 'mutate' | 'list'} action
 */
function respondRelationGroupDbError(error, req, res, _handleDbError, action = 'mutate') {
  const err = /** @type {{ message?: string, code?: string, constraint?: string, table?: string, column?: string }} */ (
    error && typeof error === 'object' ? error : {}
  )
  const rawMessage = String(err.message ?? '')
  const pgCode = err.code ? String(err.code) : ''

  console.error('[relation-groups] db failure', {
    action,
    path: req?.originalUrl ?? req?.url,
    actorUserId: Boolean(req?.user?.id),
    gaId: Boolean(req?.gaId ?? req?.user?.gaId),
    pgCode: pgCode || undefined,
    constraint: err.constraint || undefined,
    table: err.table || undefined,
    column: err.column || undefined,
    message: rawMessage.slice(0, 160),
  })

  if (pgCode === '42P01' || /relation .+ does not exist/i.test(rawMessage)) {
    res.status(503).json({
      success: false,
      message: '가족 그룹 저장 준비가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      error: '가족 그룹 저장 준비가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      data: { code: 'RELATION_GROUP_SCHEMA_MISSING' },
    })
    return
  }

  if (pgCode === '23505' || /already_in_family|uq_crgm_active/i.test(String(err.constraint ?? ''))) {
    res.status(409).json({
      success: false,
      message: '이미 다른 가족 그룹에 포함된 고객이 있습니다.',
      error: '이미 다른 가족 그룹에 포함된 고객이 있습니다.',
      data: { code: 'RELATION_GROUP_DUPLICATE_MEMBER' },
    })
    return
  }

  const fallback =
    action === 'list'
      ? '가족 그룹을 불러오지 못했습니다. 다시 시도해 주세요.'
      : '가족 그룹을 저장하지 못했습니다. 다시 시도해 주세요.'

  res.status(500).json({
    success: false,
    message: fallback,
    error: fallback,
    data: { code: 'RELATION_GROUP_CREATE_FAILED' },
  })
}

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
      respondRelationGroupDbError(error, req, res, handleDbError, 'list')
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

      console.info('[relation-groups] create start', {
        actorUserId: Boolean(scope.userId),
        gaId: Boolean(scope.gaId),
        currentCustomerId: customerId,
        memberCount: members.length + 1,
        groupType: String(req.body?.groupType ?? req.body?.group_type ?? 'FAMILY'),
      })

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
          error: result.message,
          code: result.code,
          data: result.data ?? { code: result.code || 'RELATION_GROUP_CREATE_REJECTED' },
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
      respondRelationGroupDbError(error, req, res, handleDbError, 'create')
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
      respondRelationGroupDbError(error, req, res, handleDbError, 'mutate')
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
          error: result.message,
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
      respondRelationGroupDbError(error, req, res, handleDbError, 'mutate')
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
        respondRelationGroupDbError(error, req, res, handleDbError, 'mutate')
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
        respondRelationGroupDbError(error, req, res, handleDbError, 'mutate')
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
      respondRelationGroupDbError(error, req, res, handleDbError, 'mutate')
    }
  })
}
