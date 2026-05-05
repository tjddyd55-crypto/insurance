import { Link } from 'react-router-dom'
import ResponsiveLayout from '../../../../components/ResponsiveLayout'
import { CUSTOMER_FIELD_REGISTRY_BY_KEY } from '../../../customer-templates/registry/customerFieldRegistry'
import { FEATURE_MODULE_REGISTRY_BY_ID } from '../../../customer-templates/registry/featureModuleRegistry'
import {
  countByStatus,
  countDomainsFromFeatures,
  countDomainsFromFields,
  sortFeatureDefinitions,
  sortFieldDefinitions,
  type PlatformRegistriesViewProps,
} from './platformRegistriesViewModel'
import PlatformRegistriesMobileView from './PlatformRegistriesMobileView'
import PlatformRegistriesPCView from './PlatformRegistriesPCView'

export type { PlatformRegistriesViewProps }

function buildPlatformRegistriesViewProps(): PlatformRegistriesViewProps {
  const fieldsSorted = sortFieldDefinitions(Object.values(CUSTOMER_FIELD_REGISTRY_BY_KEY))
  const featuresSorted = sortFeatureDefinitions(Object.values(FEATURE_MODULE_REGISTRY_BY_ID))
  return {
    fieldsSorted,
    featuresSorted,
    fieldTotals: {
      total: fieldsSorted.length,
      byStatus: countByStatus(fieldsSorted),
    },
    featureTotals: {
      total: featuresSorted.length,
      byStatus: countByStatus(featuresSorted),
    },
    fieldDomains: countDomainsFromFields(fieldsSorted),
    featureDomains: countDomainsFromFeatures(featuresSorted),
  }
}

export default function PlatformRegistriesPage() {
  return (
    <>
      <div className="platform-admin-page__toolbar">
        <Link to="/admin/platform" className="platform-admin-page__back">
          ← 플랫폼 관리
        </Link>
      </div>
      <ResponsiveLayout<PlatformRegistriesViewProps>
        PC={PlatformRegistriesPCView}
        Mobile={PlatformRegistriesMobileView}
        viewProps={buildPlatformRegistriesViewProps()}
      />
    </>
  )
}
