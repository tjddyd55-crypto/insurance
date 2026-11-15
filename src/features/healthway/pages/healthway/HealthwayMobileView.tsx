import { HealthwayWorkspace } from '../../components/HealthwayWorkspace'
import type { HealthwayController } from '../../useHealthwayController'
export default function HealthwayMobileView({ controller }: { controller: HealthwayController }) {
  return <section className="healthway-page healthway-page--mobile"><HealthwayWorkspace controller={controller} variant="mobile" /></section>
}
