import { Link } from 'react-router-dom'

export function PublicAdvisorHeader() {
  return (
    <header className="pap-public-header">
      <Link to="/experts" className="pap-public-header__brand">ONE FC</Link>
      <Link to="/experts" className="pap-public-header__link">설계사 찾기</Link>
    </header>
  )
}
