#!/usr/bin/env node
'use strict'
const fs = require('fs')

const env = Object.fromEntries(
  fs
    .readFileSync('/home/ubuntu/sms-server/.env', 'utf8')
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('=')
      if (i <= 0) return null
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
    .filter(Boolean),
)

function maskPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 7) return '****'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function ymdOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

async function postForm(url, fields) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === '') continue
    params.set(k, String(v))
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { parseError: true, text: String(text).slice(0, 400) }
  }
  return { httpStatus: res.status, data }
}

;(async () => {
  const apikey = env.ALIGO_KAKAO_API_KEY
  const userid = env.ALIGO_KAKAO_USER_ID
  const queries = [
    { label: 'default_recent', fields: { apikey, userid, page: 1, limit: 50 } },
    {
      label: 'last7',
      fields: { apikey, userid, page: 1, limit: 50, startdate: ymdOffset(-7), enddate: ymdOffset(0) },
    },
    {
      label: 'jul20',
      fields: { apikey, userid, page: 1, limit: 50, startdate: '20260720', enddate: '20260721' },
    },
  ]

  for (const q of queries) {
    const res = await postForm('https://kakaoapi.aligo.in/akv10/history/list/', q.fields)
    const list = Array.isArray(res.data.list) ? res.data.list : []
    console.log(
      JSON.stringify(
        {
          query: q.label,
          httpStatus: res.httpStatus,
          code: res.data.code,
          message: res.data.message,
          totalCount: res.data.totalCount,
          listCount: list.length,
          items: list.slice(0, 15).map((item) => ({
            mid: item.mid != null ? String(item.mid) : null,
            type: item.type != null ? String(item.type) : null,
            msg_count: item.msg_count != null ? String(item.msg_count) : null,
            reserve_state: item.reserve_state != null ? String(item.reserve_state) : null,
            reserve_date: item.reserve_date != null ? String(item.reserve_date) : null,
            reg_date:
              item.reg_date != null
                ? String(item.reg_date)
                : item.regdate != null
                  ? String(item.regdate)
                  : null,
            senderMasked: maskPhone(item.sender),
            mbodyPreview:
              typeof item.mbody === 'string'
                ? String(item.mbody).replace(/\s+/g, ' ').slice(0, 80)
                : null,
          })),
        },
        null,
        2,
      ),
    )
  }

  // Probe send response shape with testMode=Y (Aligo test — no live Kakao expected)
  // Use a dummy receiver; keep secrets out of logs.
  const probeReceiver = String(env.ALIMTALK_LIVE_TEST_RECIPIENT || '').replace(/\D/g, '')
  if (probeReceiver && env.ALIGO_KAKAO_SENDER_KEY && env.ALIGO_SENDER) {
    const params = new URLSearchParams()
    params.set('apikey', apikey)
    params.set('userid', userid)
    params.set('senderkey', env.ALIGO_KAKAO_SENDER_KEY)
    params.set('tpl_code', 'UJ_6670')
    params.set('sender', String(env.ALIGO_SENDER).replace(/\D/g, ''))
    params.set('receiver_1', probeReceiver)
    params.set('recvname_1', '테스트')
    params.set('subject_1', '고객정보 등록 안내')
    params.set(
      'message_1',
      '고객님, 아래 버튼을 눌러 고객정보를 등록해 주세요.\n\n담당자가 요청한 고객정보 등록 안내입니다.',
    )
    // Intentionally minimal — may fail template match; we only need response shape / whether mid appears
    params.set(
      'button_1',
      JSON.stringify({
        button: [
          {
            name: '고객정보 등록',
            linkType: 'WL',
            linkTypeName: '웹링크',
            linkMo: 'https://example.com/register',
            linkPc: 'https://example.com/register',
          },
        ],
      }),
    )
    params.set('failover', 'N')
    params.set('testMode', 'Y')
    const sendRes = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const sendText = await sendRes.text()
    let sendData = {}
    try {
      sendData = sendText ? JSON.parse(sendText) : {}
    } catch {
      sendData = { parseError: true, text: String(sendText).slice(0, 400) }
    }
    const info =
      sendData.info && typeof sendData.info === 'object'
        ? {
            mid: sendData.info.mid != null ? String(sendData.info.mid) : null,
            type: sendData.info.type != null ? String(sendData.info.type) : null,
            scnt: sendData.info.scnt != null ? Number(sendData.info.scnt) : null,
            fcnt: sendData.info.fcnt != null ? Number(sendData.info.fcnt) : null,
            pcnt: sendData.info.pcnt != null ? Number(sendData.info.pcnt) : null,
            total: sendData.info.total != null ? Number(sendData.info.total) : null,
            unit: sendData.info.unit != null ? Number(sendData.info.unit) : null,
            infoKeys: Object.keys(sendData.info),
          }
        : null
    console.log(
      JSON.stringify(
        {
          probe: 'testMode_Y_send_shape',
          httpStatus: sendRes.status,
          topKeys: Object.keys(sendData),
          code: sendData.code,
          message: sendData.message,
          info,
          receiverMasked: maskPhone(probeReceiver),
        },
        null,
        2,
      ),
    )
  } else {
    console.log(JSON.stringify({ probe: 'skipped_no_test_recipient' }))
  }
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }))
  process.exit(1)
})
