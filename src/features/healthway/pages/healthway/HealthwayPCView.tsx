import { HealthwayWorkspace } from '../../components/HealthwayWorkspace'
import type { HealthwayController } from '../../useHealthwayController'
export default function HealthwayPCView({ controller }: { controller: HealthwayController }) {
  return <section className="healthway-page healthway-page--pc"><HealthwayWorkspace controller={controller} variant="pc" /></section>
}
