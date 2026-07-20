#!/usr/bin/env node
'use strict'
const fs = require('fs')
const crypto = require('crypto')

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

function fp(v) {
  v = String(v || '')
  return v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 8) : null
}

console.log(
  JSON.stringify(
    {
      ALIGO_KAKAO_API_KEY_fp: fp(env.ALIGO_KAKAO_API_KEY),
      ALIGO_KAKAO_API_KEY_len: (env.ALIGO_KAKAO_API_KEY || '').length,
      ALIGO_KAKAO_USER_ID_fp: fp(env.ALIGO_KAKAO_USER_ID),
      ALIGO_KAKAO_USER_ID_len: (env.ALIGO_KAKAO_USER_ID || '').length,
      ALIGO_KAKAO_SENDER_KEY_fp: fp(env.ALIGO_KAKAO_SENDER_KEY),
      ALIGO_KAKAO_SENDER_KEY_len: (env.ALIGO_KAKAO_SENDER_KEY || '').length,
      ALIGO_SENDER_last4: String(env.ALIGO_SENDER || '')
        .replace(/\D/g, '')
        .slice(-4),
      ALIGO_API_KEY_fp: fp(env.ALIGO_API_KEY),
      ALIGO_USER_ID_fp: fp(env.ALIGO_USER_ID),
      sameApiKeyAsKakao: fp(env.ALIGO_API_KEY) === fp(env.ALIGO_KAKAO_API_KEY),
      sameUserIdAsKakao: fp(env.ALIGO_USER_ID) === fp(env.ALIGO_KAKAO_USER_ID),
    },
    null,
    2,
  ),
)
