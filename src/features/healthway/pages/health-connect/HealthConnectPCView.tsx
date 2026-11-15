import { HealthConnectFlow } from '../../components/HealthConnectFlow'
import type { PublicController } from '../HealthConnectPage'
export default function HealthConnectPCView({ controller }: { controller: PublicController }) {
  return <main className="health-connect-page health-connect-page--pc"><HealthConnectFlow controller={controller} /></main>
}
