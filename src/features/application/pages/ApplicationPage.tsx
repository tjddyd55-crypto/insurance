import useIsMobile from '../../../hooks/useIsMobile'
import ApplicationMobileView from './mobile/ApplicationMobileView'
import ApplicationPCView from './pc/ApplicationPCView'

export default function ApplicationPage() {
  const isMobile = useIsMobile()
  return isMobile ? <ApplicationMobileView /> : <ApplicationPCView />
}
