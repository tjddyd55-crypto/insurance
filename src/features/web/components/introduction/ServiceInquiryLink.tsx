import {
  INTRO_SERVICE_INQUIRY_ARIA_LABEL,
  INTRO_SERVICE_INQUIRY_HREF,
  INTRO_SERVICE_INQUIRY_TITLE,
} from '../../config/introductionFeatureContent'

type ServiceInquiryLinkProps = {
  className?: string
  variant?: 'green' | 'white' | 'cta-white' | 'cta-outline'
}

export function ServiceInquiryLink({ className = '', variant = 'green' }: ServiceInquiryLinkProps) {
  const variantClass =
    variant === 'white'
      ? 'intro-v2-btn intro-v2-btn--white'
      : variant === 'cta-white'
        ? 'intro-v2-cta__action intro-v2-cta__action--white'
        : variant === 'cta-outline'
          ? 'intro-v2-cta__action intro-v2-cta__action--outline'
          : 'intro-v2-btn intro-v2-btn--green'

  return (
    <a
      className={`${variantClass}${className ? ` ${className}` : ''}`}
      href={INTRO_SERVICE_INQUIRY_HREF}
      aria-label={INTRO_SERVICE_INQUIRY_ARIA_LABEL}
      title={INTRO_SERVICE_INQUIRY_TITLE}
    >
      서비스 문의하기
    </a>
  )
}
