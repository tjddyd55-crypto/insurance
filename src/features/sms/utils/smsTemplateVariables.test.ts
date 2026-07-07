import { describe, expect, it } from 'vitest'
import { SMS_ENABLED_TEMPLATE_VARIABLES } from './smsTemplateVariables'

describe('SMS_ENABLED_TEMPLATE_VARIABLES', () => {
  it('exposes only customer name chip in the initial version', () => {
    expect(SMS_ENABLED_TEMPLATE_VARIABLES).toHaveLength(1)
    expect(SMS_ENABLED_TEMPLATE_VARIABLES[0]?.id).toBe('customerName')
    expect(SMS_ENABLED_TEMPLATE_VARIABLES[0]?.chipLabel).toBe('고객명')
    expect(SMS_ENABLED_TEMPLATE_VARIABLES[0]?.enabled).toBe(true)
  })
})
