import assert from 'node:assert/strict'
import test from 'node:test'

import { logR2EnvDiagnosticCheck } from './consentStorage.js'

test('logR2EnvDiagnosticCheck masks access and secret keys', () => {
  const prevAccess = process.env.R2_ACCESS_KEY_ID
  const prevSecret = process.env.R2_SECRET_ACCESS_KEY
  process.env.R2_ACCESS_KEY_ID = 'test_access_key_1234'
  process.env.R2_SECRET_ACCESS_KEY = 'test_secret_key_5678'

  const logs = []
  const originalLog = console.log
  console.log = (...args) => {
    logs.push(args)
  }

  try {
    logR2EnvDiagnosticCheck()
    assert.equal(logs.length, 1)
    const payload = logs[0][1]
    assert.match(payload.accessKey, /^te\*\*\*\*34$/)
    assert.match(payload.secretKey, /^te\*\*\*\*78$/)
    assert.equal(payload.accessKey.includes('test_access_key_1234'), false)
    assert.equal(payload.secretKey.includes('test_secret_key_5678'), false)
  } finally {
    console.log = originalLog
    if (prevAccess == null) delete process.env.R2_ACCESS_KEY_ID
    else process.env.R2_ACCESS_KEY_ID = prevAccess
    if (prevSecret == null) delete process.env.R2_SECRET_ACCESS_KEY
    else process.env.R2_SECRET_ACCESS_KEY = prevSecret
  }
})
