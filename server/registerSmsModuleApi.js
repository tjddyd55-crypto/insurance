import {
  cancelSmsCampaign,
  createSmsCampaign,
  getSmsCampaign,
  listSmsCampaigns,
  previewSmsCampaign,
  sendSmsCampaignNow,
} from './sms/smsCampaignService.js'
import { listSmsCampaignHistory, listSmsCampaignRecipients, sendSingleSms } from './sms/smsSendService.js'
import { resolveSmsAuthContext } from './sms/smsScope.js'
import {
  createSmsSender,
  deleteSmsSender,
  getSmsBalance,
  listSmsSenders,
  patchSmsSender,
  testSmsSend,
} from './sms/smsSenderService.js'
import {
  deleteAligoSmsSettings,
  getSmsSettings,
  upsertAligoSmsSettings,
} from './sms/smsSettingsService.js'
import {
  addSmsOptOut,
  createSmsTemplate,
  deleteSmsTemplate,
  listSmsOptOuts,
  listSmsTemplates,
  removeSmsOptOut,
  updateSmsTemplate,
} from './sms/smsTemplateService.js'
import { assertSmsModuleFeatureEnabled, assertSmsRealSendAllowed } from './sms/smsModuleConfig.js'

function smsApiError(res, err) {
  const status = Number(err?.status ?? 500)
  const code = String(err?.message ?? 'sms_error')
  const genericMessage =
    status >= 500 && (code.includes('credential') || code.includes('decrypt') || code.includes('secret'))
      ? '문자 기능 처리 중 오류가 발생했습니다.'
      : err?.publicMessage ?? (status >= 500 ? '문자 기능 처리 중 오류가 발생했습니다.' : code)
  res.status(status).json({
    success: false,
    message: genericMessage,
    code,
  })
}

function ensureSmsModuleEnabled(req, res, next) {
  try {
    assertSmsModuleFeatureEnabled()
    next()
  } catch (e) {
    if (e?.status) {
      smsApiError(res, e)
      return
    }
    next(e)
  }
}

function ensureSmsRealSendEnabled(req, res, next) {
  try {
    assertSmsRealSendAllowed()
    next()
  } catch (e) {
    if (e?.status) {
      smsApiError(res, e)
      return
    }
    next(e)
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool; requireAuth: Function; handleDbError: Function }} ctx
 */
export function registerSmsModuleApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/sms/settings', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const settings = await getSmsSettings(pool, scope)
      res.json({ success: true, data: settings })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/settings/aligo', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const settings = await upsertAligoSmsSettings(pool, scope, {
        aligoUserId: body.aligo_user_id ?? body.aligoUserId,
        apiKey: body.api_key ?? body.apiKey,
        defaultSender: body.default_sender ?? body.defaultSender,
      })
      res.json({ success: true, data: settings })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/sms/settings/aligo', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const settings = await upsertAligoSmsSettings(pool, scope, {
        aligoUserId: body.aligo_user_id ?? body.aligoUserId ?? '',
        apiKey: body.api_key ?? body.apiKey,
        defaultSender: body.default_sender ?? body.defaultSender,
      })
      res.json({ success: true, data: settings })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.delete('/sms/settings/aligo', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const settings = await deleteAligoSmsSettings(pool, scope)
      res.json({ success: true, data: settings })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/senders', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const rows = await listSmsSenders(pool, scope)
      res.json({ success: true, data: rows })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/senders', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const row = await createSmsSender(pool, scope, {
        senderNumber: body.sender_number ?? body.senderNumber,
        label: body.label,
        isDefault: body.is_default ?? body.isDefault,
      })
      res.json({ success: true, data: row })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/sms/senders/:id', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const senderId = Number(req.params.id)
      const body = req.body ?? {}
      const row = await patchSmsSender(
        pool,
        { ...scope, senderId },
        {
          label: body.label,
          isDefault: body.is_default ?? body.isDefault,
          status: body.status,
        },
      )
      res.json({ success: true, data: row })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.delete('/sms/senders/:id', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const senderId = Number(req.params.id)
      const result = await deleteSmsSender(pool, { ...scope, senderId })
      res.json({ success: true, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/senders/:id/test', requireAuth, ensureSmsModuleEnabled, ensureSmsRealSendEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const senderId = Number(req.params.id)
      const senders = await listSmsSenders(pool, scope)
      const sender = senders.find((s) => s.id === senderId)
      if (!sender) {
        res.status(404).json({ success: false, message: '발신번호를 찾을 수 없습니다.' })
        return
      }
      const body = req.body ?? {}
      const result = await testSmsSend(pool, scope, {
        senderNumber: sender.senderNumber,
        receiver: body.receiver ?? body.test_receiver ?? body.testReceiver,
        message: body.message ?? 'CRM 문자 연동 테스트입니다.',
      })
      res.json({ success: result.success, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/test-send', requireAuth, ensureSmsModuleEnabled, ensureSmsRealSendEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const result = await testSmsSend(pool, scope, {
        senderNumber: body.sender_number ?? body.senderNumber,
        receiver: body.receiver,
        message: body.message,
      })
      res.json({ success: result.success, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/balance', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const result = await getSmsBalance(pool, scope)
      res.json({ success: result.success, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/send', requireAuth, ensureSmsModuleEnabled, ensureSmsRealSendEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const result = await sendSingleSms(pool, scope, {
        senderNumber: body.sender_number ?? body.senderNumber,
        receiver: body.receiver,
        message: body.message,
        customerId: body.customer_id ?? body.customerId,
        messageType: body.message_type ?? body.messageType,
      })
      res.json({ success: result.success, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/campaigns', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const rows = await listSmsCampaigns(pool, scope, {
        limit: Number(req.query.limit ?? 50),
        offset: Number(req.query.offset ?? 0),
      })
      res.json({ success: true, data: rows })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/campaigns/:id', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const row = await getSmsCampaign(pool, scope, Number(req.params.id))
      res.json({ success: true, data: row })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/campaigns/:id/recipients', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const rows = await listSmsCampaignRecipients(pool, scope, Number(req.params.id))
      res.json({ success: true, data: rows })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/campaigns/preview', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const preview = await previewSmsCampaign(pool, scope, {
        senderNumber: body.sender_number ?? body.senderNumber,
        message: body.message,
        messageType: body.message_type ?? body.messageType,
        customerIds: body.customer_ids ?? body.customerIds,
        filter: body.filter,
      })
      res.json({ success: true, data: preview })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/campaigns', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const created = await createSmsCampaign(pool, scope, {
        title: body.title,
        senderNumber: body.sender_number ?? body.senderNumber,
        message: body.message,
        messageType: body.message_type ?? body.messageType,
        customerIds: body.customer_ids ?? body.customerIds,
        filter: body.filter,
        scheduledAt: body.scheduled_at ?? body.scheduledAt ?? null,
      })
      res.json({ success: true, data: created })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/campaigns/:id/send', requireAuth, ensureSmsModuleEnabled, ensureSmsRealSendEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const result = await sendSmsCampaignNow(pool, scope, Number(req.params.id), {
        previewConfirmed: body.preview_confirmed === true || body.previewConfirmed === true,
      })
      res.json({ success: true, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/campaigns/:id/cancel', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const result = await cancelSmsCampaign(pool, scope, Number(req.params.id))
      res.json({ success: true, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/history', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const rows = await listSmsCampaignHistory(pool, {
        tenantId: scope.tenantId,
        userId: scope.userId,
        limit: Number(req.query.limit ?? 50),
        offset: Number(req.query.offset ?? 0),
      })
      res.json({ success: true, data: rows })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/templates', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const rows = await listSmsTemplates(pool, scope)
      res.json({ success: true, data: rows })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/templates', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const row = await createSmsTemplate(pool, scope, {
        title: body.title,
        message: body.message,
        messageType: body.message_type ?? body.messageType,
      })
      res.status(201).json({ success: true, data: row })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/sms/templates/:id', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const row = await updateSmsTemplate(pool, scope, Number(req.params.id), {
        title: body.title,
        message: body.message,
        messageType: body.message_type ?? body.messageType,
      })
      res.json({ success: true, data: row })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.delete('/sms/templates/:id', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const result = await deleteSmsTemplate(pool, scope, Number(req.params.id))
      res.json({ success: true, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/sms/opt-outs', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const rows = await listSmsOptOuts(pool, scope)
      res.json({ success: true, data: rows })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/sms/opt-outs', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const body = req.body ?? {}
      const row = await addSmsOptOut(pool, scope, {
        phone: body.phone,
        reason: body.reason,
      })
      res.status(201).json({ success: true, data: row })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.delete('/sms/opt-outs/:id', requireAuth, ensureSmsModuleEnabled, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const result = await removeSmsOptOut(pool, scope, Number(req.params.id))
      res.json({ success: true, data: result })
    } catch (e) {
      if (e?.status) {
        smsApiError(res, e)
        return
      }
      handleDbError(e, req, res)
    }
  })
}
