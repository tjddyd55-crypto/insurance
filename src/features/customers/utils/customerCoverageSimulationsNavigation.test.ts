import { describe, expect, it } from 'vitest'

import {
  buildCustomerCoverageSimulationsReturnUrl,
  parseCustomerCoverageSimulationsReturnUrl,
} from './customerCoverageSimulationsNavigation'

describe('customerCoverageSimulationsNavigation', () => {
  it('builds pathname with templateId and simulationId query', () => {
    expect(
      buildCustomerCoverageSimulationsReturnUrl('/customers/1598/coverage-simulations', {
        templateId: 'tpl-1',
        simulationId: 'sim-2',
      }),
    ).toBe('/customers/1598/coverage-simulations?templateId=tpl-1&simulationId=sim-2')
  })

  it('parses returnTo into pathname and search', () => {
    expect(
      parseCustomerCoverageSimulationsReturnUrl(
        '/customers/1598/coverage-simulations?templateId=a&simulationId=b',
      ),
    ).toEqual({
      pathname: '/customers/1598/coverage-simulations',
      search: '?templateId=a&simulationId=b',
    })
  })
})
