import { NavLink } from 'react-router-dom'

function subnavLinkClass(isActive: boolean): string {
  return `filter-button insurance-claim-subnav__link${isActive ? ' filter-button--workspace-active' : ''}`
}

export default function InsuranceClaimSubnav() {
  return (
    <nav className="insurance-claim-subnav" aria-label="보험청구">
      <NavLink
        to="/insurance-claim/new"
        className={({ isActive }) => subnavLinkClass(isActive)}
        end
      >
        새청구
      </NavLink>
      <NavLink
        to="/insurance-claim/requests"
        className={({ isActive }) => subnavLinkClass(isActive)}
        isActive={(_, location) => {
          const path = location.pathname
          if (path === '/insurance-claim/requests') {
            return true
          }
          return /^\/insurance-claim\/requests\/\d+/.test(path)
        }}
      >
        청구내역
      </NavLink>
    </nav>
  )
}
