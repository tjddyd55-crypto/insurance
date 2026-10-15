import { FF_INSTALL_SECTION_ID } from '../config/facebookFounderLandingContent'

export function scrollToFacebookInstallSection(event: { preventDefault: () => void }) {
  event.preventDefault()
  document.getElementById(FF_INSTALL_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
