import { NavLink } from 'react-router-dom'
import { GA_STAFF_MENU } from '../dashboard/gaTenantMenu'
import '../ga-admin/ga-admin-workspace.css'

/** GA_STAFF 업무 화면 상단 탭 — GA_STAFF_MENU · gaStaffPathPolicy 와 동일 path */
export function GaStaffOpsNav() {
  return (
    <nav className="ga-admin-workspace-tabs admin-page-shell__tabs" aria-label="STEP 업무 메뉴">
      {GA_STAFF_MENU.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `ga-admin-workspace-tabs__link${isActive ? ' ga-admin-workspace-tabs__link--active' : ''}`
          }
          end={item.path === '/feature-request'}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
