import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let messaging = null
let initAttempted = false
let initError = null

/**
 * Firebase Admin Messaging (optional).
 * Credentials missing → soft-disable (claim save still succeeds).
 */
export function getFirebaseMessaging() {
  if (initAttempted) {
    return messaging
  }
  initAttempted = true
  try {
    const projectId = String(process.env.FIREBASE_PROJECT_ID ?? '').trim()
    const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? '').trim()
    let privateKey = String(process.env.FIREBASE_PRIVATE_KEY ?? '').trim()
    if (!projectId || !clientEmail || !privateKey) {
      initError = 'FIREBASE_* credentials not configured'
      return null
    }
    privateKey = privateKey.replace(/\\n/g, '\n')
    // eslint-disable-next-line import/no-extraneous-dependencies
    const admin = require('firebase-admin')
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
    }
    messaging = admin.messaging()
    return messaging
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error)
    messaging = null
    return null
  }
}

export function getFirebaseInitError() {
  getFirebaseMessaging()
  return initError
}

export function isFirebasePushConfigured() {
  return getFirebaseMessaging() != null
}
