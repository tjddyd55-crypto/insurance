import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { RegisterPage } from '../../auth/pages/RegisterPage'
import {
  buildGaGroupLandingPath,
  fetchPublicGaGroup,
  type PublicGaGroupInfo,
} from '../../admin/api/gaGroupApi'
import '../ga-group-landing.css'

export function GaGroupSignupPage() {
  const { groupSlug = '' } = useParams()
  const [group, setGroup] = useState<PublicGaGroupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const data = await fetchPublicGaGroup(groupSlug)
      if (cancelled) {
        return
      }
      if (!data) {
        setMissing(true)
        setGroup(null)
      } else {
        setMissing(false)
        setGroup(data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [groupSlug])

  if (loading) {
    return (
      <main className="ga-group-landing">
        <p className="ga-group-landing__muted">불러오는 중…</p>
      </main>
    )
  }

  if (missing || !group) {
    return (
      <main className="ga-group-landing">
        <h1>가입 페이지를 찾을 수 없습니다</h1>
        <Link to="/introduction">ONE FC 소개</Link>
      </main>
    )
  }

  return (
    <div className="ga-group-landing ga-group-landing--signup">
      <header className="ga-group-landing__header">
        {group.logoUrl ?
          <img src={group.logoUrl} alt="" className="ga-group-landing__logo" />
        : null}
        <div>
          <p className="ga-group-landing__eyebrow">회원가입</p>
          <h1 className="ga-group-landing__title">{group.name}</h1>
          <Link to={buildGaGroupLandingPath(group.slug)} className="ga-group-landing__muted">
            랜딩페이지로 돌아가기
          </Link>
        </div>
      </header>
      <RegisterPage
        gaGroupSignup={{
          slug: group.slug,
          groupName: group.name,
          logoUrl: group.logoUrl,
        }}
      />
    </div>
  )
}

export default GaGroupSignupPage
