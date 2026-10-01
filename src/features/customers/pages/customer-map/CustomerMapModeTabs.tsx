import { NavLink } from 'react-router-dom'

export default function CustomerMapModeTabs() {
  return (
    <div className="customers-map-page__mode-tabs" role="tablist" aria-label="고객 지도 보기">
      <NavLink
        to="/customers/map"
        end
        role="tab"
        className={({ isActive }) =>
          isActive
            ? 'customers-map-page__mode-tab customers-map-page__mode-tab--active'
            : 'customers-map-page__mode-tab'
        }
      >
        지도
      </NavLink>
      <NavLink
        to="/customers/map/regions"
        role="tab"
        className={({ isActive }) =>
          isActive
            ? 'customers-map-page__mode-tab customers-map-page__mode-tab--active'
            : 'customers-map-page__mode-tab'
        }
      >
        지역별 고객
      </NavLink>
    </div>
  )
}
