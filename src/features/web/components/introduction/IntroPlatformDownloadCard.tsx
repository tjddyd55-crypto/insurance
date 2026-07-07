export type IntroPlatformDownloadCardProps = {
  title: string
  description: string
  href: string
  buttonLabel: string
  badge: string
  iconLabel: string
  download?: boolean
  external?: boolean
  iconVariant?: 'primary' | 'platform'
  badgeVariant?: 'default' | 'platform'
}

export function IntroPlatformDownloadCard({
  title,
  description,
  href,
  buttonLabel,
  badge,
  iconLabel,
  download = false,
  external = false,
  iconVariant = 'primary',
  badgeVariant = 'default',
}: IntroPlatformDownloadCardProps) {
  const iconClassName = [
    'intro-install-download-card__icon',
    iconVariant === 'platform' ? 'intro-install-download-card__icon--platform' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const badgeClassName = [
    'intro-install-download-card__badge',
    badgeVariant === 'platform' ? 'intro-install-download-card__badge--platform' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const linkProps = external
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : download
      ? { download: true }
      : {}

  return (
    <article className="intro-install-download-card intro-platform-download-card">
      <div className="intro-install-download-card__head">
        <div className={iconClassName}>
          <span>{iconLabel}</span>
        </div>
        <div className="intro-install-download-card__title-wrap">
          <h3>{title}</h3>
          <span className={badgeClassName}>{badge}</span>
        </div>
      </div>
      <p>{description}</p>
      <a href={href} {...linkProps}>
        <span className="intro-install-download-card__btn-icon" aria-hidden="true">
          {external ? '↗' : '↓'}
        </span>
        {buttonLabel}
      </a>
    </article>
  )
}
