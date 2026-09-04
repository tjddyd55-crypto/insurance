import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getSmsOutboundServerIpHint,
  getSmsOutboundServerIpList,
  parseSmsOutboundIpList,
} from './smsOutboundIp.js'

test('parseSmsOutboundIpList: empty → []', () => {
  assert.deepEqual(parseSmsOutboundIpList(''), [])
  assert.deepEqual(parseSmsOutboundIpList(null), [])
})

test('parseSmsOutboundIpList: single IP', () => {
  assert.deepEqual(parseSmsOutboundIpList('162.220.232.251'), ['162.220.232.251'])
})

test('parseSmsOutboundIpList: comma / space / newline list, dedupe', () => {
  assert.deepEqual(
    parseSmsOutboundIpList('162.220.232.251, 152.55.177.181\n152.55.177.193,162.220.232.251'),
    ['162.220.232.251', '152.55.177.181', '152.55.177.193'],
  )
})

test('parseSmsOutboundIpList: rejects non-ipv4 tokens', () => {
  assert.deepEqual(parseSmsOutboundIpList('not-an-ip, 1.2.3.4'), ['1.2.3.4'])
})

test('getSmsOutboundServerIpList reads SMS_MODULE_OUTBOUND_IP_HINT', () => {
  const list = getSmsOutboundServerIpList({
    SMS_MODULE_OUTBOUND_IP_HINT: '10.0.0.1;10.0.0.2',
  })
  assert.deepEqual(list, ['10.0.0.1', '10.0.0.2'])
  assert.equal(
    getSmsOutboundServerIpHint({ SMS_MODULE_OUTBOUND_IP_HINT: '10.0.0.1;10.0.0.2' }),
    '10.0.0.1, 10.0.0.2',
  )
})

test('getSmsOutboundServerIpList falls back to SMS_OUTBOUND_IP_HINT', () => {
  assert.deepEqual(
    getSmsOutboundServerIpList({ SMS_OUTBOUND_IP_HINT: '8.8.8.8' }),
    ['8.8.8.8'],
  )
})
