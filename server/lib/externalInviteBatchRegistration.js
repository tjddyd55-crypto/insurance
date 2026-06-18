export const EXTERNAL_INVITE_BATCH_MAX = 10

/**
 * @param {unknown} customers
 * @returns {{ ok: true, customers: Record<string, unknown>[] } | { ok: false, errors: Array<{ index: number, field: string, message: string }> }}
 */
export function validateExternalInviteBatchCustomers(customers) {
  if (!Array.isArray(customers)) {
    return {
      ok: false,
      errors: [{ index: 0, field: 'customers', message: '등록할 고객 정보가 없습니다.' }],
    }
  }
  if (customers.length === 0) {
    return {
      ok: false,
      errors: [{ index: 0, field: 'customers', message: '등록할 고객 정보가 없습니다.' }],
    }
  }
  if (customers.length > EXTERNAL_INVITE_BATCH_MAX) {
    return {
      ok: false,
      errors: [
        {
          index: 0,
          field: 'customers',
          message: '한 번에 최대 10명까지 등록할 수 있습니다.',
        },
      ],
    }
  }

  /** @type {Array<{ index: number, field: string, message: string }>} */
  const errors = []
  customers.forEach((row, index) => {
    const name = String(row?.name ?? '').trim()
    if (!name) {
      errors.push({ index, field: 'name', message: '이름은 필수입니다.' })
    }
  })

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, customers }
}
