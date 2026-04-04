import jwt from 'jsonwebtoken'

export const SIGNUP_PHONE_JWT_TYP = 'signup_phone_verified'

const PHONE_CHANGE_JWT_TYP = 'phone_change_verified'

/**
 * @param {object} p
 * @param {string} p.JWT_SECRET
 * @param {string} p.phoneDigits
 * @param {string} p.inviteCodeNormalized
 * @param {number} p.gaId
 */
export function issueSignupPhoneProof({ JWT_SECRET, phoneDigits, inviteCodeNormalized, gaId }) {
  return jwt.sign(
    {
      typ: SIGNUP_PHONE_JWT_TYP,
      ph: phoneDigits,
      inv: inviteCodeNormalized,
      ga: gaId,
    },
    JWT_SECRET,
    { expiresIn: '10m' },
  )
}

/**
 * @returns {{ phoneDigits: string, inviteCodeNormalized: string, gaId: number }}
 */
export function verifySignupPhoneProof(token, JWT_SECRET) {
  const raw = String(token ?? '').trim()
  if (!raw) {
    throw new Error('missing_token')
  }
  const decoded = jwt.verify(raw, JWT_SECRET)
  if (decoded.typ !== SIGNUP_PHONE_JWT_TYP) {
    throw new Error('bad_typ')
  }
  const phoneDigits = String(decoded.ph ?? '').trim()
  const inviteCodeNormalized = String(decoded.inv ?? '').trim().toUpperCase()
  const gaId = Number(decoded.ga)
  if (!phoneDigits || !inviteCodeNormalized || !Number.isInteger(gaId) || gaId < 1) {
    throw new Error('bad_payload')
  }
  return { phoneDigits, inviteCodeNormalized, gaId }
}

/**
 * @param {object} p
 * @param {string} p.JWT_SECRET
 * @param {string} p.userId
 * @param {string} p.newPhoneDigits
 */
export function issuePhoneChangeProof({ JWT_SECRET, userId, newPhoneDigits }) {
  return jwt.sign(
    {
      typ: PHONE_CHANGE_JWT_TYP,
      uid: String(userId).trim(),
      ph: String(newPhoneDigits).trim(),
    },
    JWT_SECRET,
    { expiresIn: '10m' },
  )
}

/**
 * @returns {{ userId: string, newPhoneDigits: string }}
 */
export function verifyPhoneChangeProof(token, JWT_SECRET) {
  const raw = String(token ?? '').trim()
  if (!raw) {
    throw new Error('missing_token')
  }
  const decoded = jwt.verify(raw, JWT_SECRET)
  if (decoded.typ !== PHONE_CHANGE_JWT_TYP) {
    throw new Error('bad_typ')
  }
  const userId = String(decoded.uid ?? '').trim()
  const newPhoneDigits = String(decoded.ph ?? '').trim()
  if (!userId || !newPhoneDigits) {
    throw new Error('bad_payload')
  }
  return { userId, newPhoneDigits }
}
