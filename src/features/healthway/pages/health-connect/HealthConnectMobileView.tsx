import { HealthConnectFlow } from '../../components/HealthConnectFlow'
import type { PublicController } from '../HealthConnectPage'
export default function HealthConnectMobileView({ controller }: { controller: PublicController }) {
  return <main className="health-connect-page health-connect-page--mobile"><HealthConnectFlow controller={controller} /></main>
}
