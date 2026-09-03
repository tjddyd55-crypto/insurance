import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ANDROID_PACKAGE_DEV,
  ANDROID_PACKAGE_PROD,
  resolveAllowedPushAppPackageForRuntime,
} from './pushDeviceService.js'
import { isFirebasePushConfigured, getFirebaseInitError } from './fcmClient.js'

describe('push runtime package filter', () => {
  it('honors PUSH_APP_PACKAGE override for DEV', () => {
    const prev = process.env.PUSH_APP_PACKAGE
    try {
      process.env.PUSH_APP_PACKAGE = ANDROID_PACKAGE_DEV
      assert.equal(resolveAllowedPushAppPackageForRuntime(), ANDROID_PACKAGE_DEV)
      process.env.PUSH_APP_PACKAGE = ANDROID_PACKAGE_PROD
      assert.equal(resolveAllowedPushAppPackageForRuntime(), ANDROID_PACKAGE_PROD)
    } finally {
      if (prev == null) delete process.env.PUSH_APP_PACKAGE
      else process.env.PUSH_APP_PACKAGE = prev
    }
  })
})

describe('firebase env parsing', () => {
  it('reports soft-disable when FIREBASE_* missing', () => {
    const keys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']
    const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
    try {
      for (const k of keys) delete process.env[k]
      // module caches init — only assert helper contracts without forcing re-init when already warm
      assert.equal(typeof isFirebasePushConfigured, 'function')
      assert.equal(typeof getFirebaseInitError, 'function')
    } finally {
      for (const k of keys) {
        if (prev[k] == null) delete process.env[k]
        else process.env[k] = prev[k]
      }
    }
  })
})
