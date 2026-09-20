import { splitEntitlementBadgeLabels } from './pcMenuGroupBadge'

type Props = {
  badge?: string | null
  labels?: string[] | null
  className?: string
  chipClassName?: string
}

export function PcMenuEntitlementBadges({
  badge,
  labels,
  className,
  chipClassName = 'pc-top-navigation__badge-chip',
}: Props) {
  const resolvedLabels = labels ?? (badge ? splitEntitlementBadgeLabels(badge) : [])
  if (resolvedLabels.length === 0) {
    return null
  }

  return (
    <span className={className} aria-hidden="true">
      {resolvedLabels.map((label) => (
        <span key={label} className={chipClassName}>
          {label}
        </span>
      ))}
    </span>
  )
}
