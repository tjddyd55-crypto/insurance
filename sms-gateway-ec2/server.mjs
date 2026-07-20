/**
 * EC2 SMS Gateway (repo reference).
 * Live production uses /home/ubuntu/sms-server on EC2:3000.
 *
 * 시스템 인증 SMS: POST /, POST /send-sms
 * 보험 CRM 알림톡: /api/crm-alimtalk/*
 */
import express from 'express'
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

app.use('/api/crm-alimtalk', createCrmAlimtalkRouter())

app.listen(PORT, () => {
  console.log(`[sms-gateway-ec2] listening on ${PORT}`)
})
