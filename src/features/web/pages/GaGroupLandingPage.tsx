import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ANDROID_APP_DOWNLOAD_URL,
  DESKTOP_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
} from '../constants/appInstallLinks'
import { INTRO_HERO } from '../config/introductionLandingContent'
import { BusinessInfoFooter } from '../components/BusinessInfoFooter'
import {
  buildGaGroupSignupPath,
  fetchPublicGaGroup,
  type PublicGaGroupInfo,
} from '../../admin/api/gaGroupApi'
import '../ga-group-landing.css'

export function GaGroupLandingPage() {
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
        <h1>페이지를 찾을 수 없습니다</h1>
        <p className="ga-group-landing__muted">요청한 그룹 랜딩페이지가 없거나 비활성 상태입니다.</p>
      </main>
    )
  }

  const signupPath = buildGaGroupSignupPath(group.slug)

  return (
    <div className="ga-group-landing">
      <header className="ga-group-landing__header">
        {group.logoUrl ?
          <img src={group.logoUrl} alt="" className="ga-group-landing__logo" />
        : null}
        <div>
          <p className="ga-group-landing__eyebrow">ONE FC · {group.name}</p>
          <h1 className="ga-group-landing__title">{group.name}</h1>
        </div>
      </header>

      <section className="ga-group-landing__section">
        <h2>{INTRO_HERO.title.replace(/\n/g, ' ')}</h2>
        <p>{INTRO_HERO.body}</p>
        <Link to={signupPath} className="ga-group-landing__cta">
          회원가입
        </Link>
      </section>

      <section className="ga-group-landing__section" id="download">
        <h2>ONE FC 설치</h2>
        <p>가입 후 아래 프로그램·앱으로 로그인하세요.</p>
        <ul className="ga-group-landing__downloads">
          <li>
            <a href={DESKTOP_DOWNLOAD_URL} rel="noopener noreferrer">Windows PC 프로그램</a>
          </li>
          <li>
            <a href={ANDROID_APP_DOWNLOAD_URL} rel="noopener noreferrer">Google Play (Android)</a>
          </li>
          <li>
            <a href={ONE_FC_APP_STORE_URL} rel="noopener noreferrer">App Store (iPhone)</a>
          </li>
        </ul>
      </section>

      <BusinessInfoFooter />
    </div>
  )
}

export default GaGroupLandingPage
