import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyLoginClient } from './loginClientPresentation.js'

test('classifyLoginClient recognizes browser channels and devices without exposing raw UA', () => {
  assert.deepEqual(classifyLoginClient('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'), {
    channel: 'PC_WEB', device: 'Windows PC · Chrome',
  })
  assert.deepEqual(classifyLoginClient('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36'), {
    channel: 'MOBILE_WEB', device: 'Android · Chrome',
  })
  assert.deepEqual(classifyLoginClient(''), { channel: '미확인', device: '미확인' })
})
