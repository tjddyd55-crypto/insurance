import { useRef } from 'react'
import { useParams } from 'react-router-dom'
import { RegisterPage } from '../../auth/pages/RegisterPage'

function primeGovernmentJoinAgencyCode(agencyCode?: string): void {
  const code = String(agencyCode ?? '').trim().toUpperCase()
  if (code) {
    sessionStorage.setItem('government_join_agency_code', code)
  }
}

function GovernmentJoinRegister({ agencyCode }: { agencyCode?: string }) {
  const primedRef = useRef(false)
  if (!primedRef.current) {
    primeGovernmentJoinAgencyCode(agencyCode)
    primedRef.current = true
  }
  return <RegisterPage signupIndustry="government" />
}

/**
 * /government/join/:agencyCode — agencyCode 를 가입 코드 입력란에 프리필.
 * RegisterPage 자체는 수정하지 않고 wrapper 에서 sessionStorage 로 전달.
 */
export default function GovernmentJoinPage() {
  const { agencyCode } = useParams()
  return <GovernmentJoinRegister key={agencyCode} agencyCode={agencyCode} />
}
