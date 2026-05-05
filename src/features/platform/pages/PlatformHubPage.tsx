import ResponsiveLayout from '../../../components/ResponsiveLayout'
import PlatformHubMobileView from './platform/PlatformHubMobileView'
import PlatformHubPCView from './platform/PlatformHubPCView'

const hubCards = [
  {
    to: '/admin/platform/industries',
    title: 'Industry 목록',
    description: 'industries 테이블 조회',
  },
  {
    to: '/admin/platform/tenants',
    title: 'Tenant 목록',
    description: 'tenants · GA 연계(legacy_ga_id)',
  },
  {
    to: '/admin/platform/memberships',
    title: 'User Membership',
    description: 'user_memberships (일반 users 기반)',
  },
  {
    to: '/admin/platform/external-accounts',
    title: '보험 외부 계정 요약',
    description: '원수사 담당·손해사정사 건수 (yjasset)',
  },
  {
    to: '/admin/platform/customer-templates',
    title: '고객관리 템플릿',
    description: '업종별 고객 템플릿 조회(정적)',
  },
] as const

export type PlatformHubViewProps = {
  cards: readonly (typeof hubCards)[number][]
}

export default function PlatformHubPage() {
  return (
    <ResponsiveLayout<PlatformHubViewProps>
      PC={PlatformHubPCView}
      Mobile={PlatformHubMobileView}
      viewProps={{ cards: hubCards }}
    />
  )
}

export { hubCards }
