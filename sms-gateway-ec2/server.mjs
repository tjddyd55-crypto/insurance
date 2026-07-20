/**
 * EC2 SMS Gateway
 *
 * 시스템 인증 SMS (기존):
 *   POST /, POST /send-sms  — JSON { phone, message }
 *   SMS_HTTP_GATEWAY_URL 로 Railway 메인 앱이 호출
 *
 * CRM 문자 (신규, 분리):
 *   GET  /api/crm-sms/health
 *   POST /api/crm-sms/send
 *   POST /api/crm-sms/balance
 *   Bearer CRM_SMS_GATEWAY_TOKEN (= Railway SMS_MODULE_GATEWAY_TOKEN)
 */
import express from 'express'
import { createCrmSmsRouter } from './routes/crmSms.mjs'
import { createCrmAlimtalkRouter } from './routes/crmAlimtalk.mjs'

const PORT = Number(process.env.PORT ?? 3080)

const app = express()
app.use(express.json({ limit: '256kb' }))

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'sms-gateway-ec2' })
})

const smsHandler = async (req, res) => {
  const phone = String(req.body?.phone ?? '').trim()
  const message = String(req.body?.message ?? '').trim()
  if (!phone || !message) {
    res.status(400).json({ error: 'phone and message required' })
    return
  }

  if (String(process.env.SMS_GATEWAY_STUB_OK ?? '').trim() === 'true') {
    res.status(200).json({ ok: true, stub: true })
    return
  }

  res.status(501).json({ error: 'SMS provider not wired; set SMS_GATEWAY_STUB_OK=true for smoke test' })
}

app.post('/', smsHandler)
app.post('/send-sms', smsHandler)

app.use('/api/crm-sms', createCrmSmsRouter())
app.use('/api/crm-alimtalk', createCrmAlimtalkRouter())

app.listen(PORT, () => {
  console.log(`[sms-gateway-ec2] listening on ${PORT}`)
})
