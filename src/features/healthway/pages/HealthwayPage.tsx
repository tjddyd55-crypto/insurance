import { useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useAuth } from '../../auth/AuthProvider'
import { useHealthwayController } from '../useHealthwayController'
import HealthwayPCView from './healthway/HealthwayPCView'
import HealthwayMobileView from './healthway/HealthwayMobileView'
import '../healthway.css'
function CustomerHealthway({ customerId }: { customerId: number }) {
  const { token } = useAuth(), controller = useHealthwayController(customerId, token)
  return <ResponsiveLayout PC={HealthwayPCView} Mobile={HealthwayMobileView} viewProps={{ controller }} />
}
export default function HealthwayPage() {
  const { customerId } = useParams()
  return <CustomerHealthway key={customerId} customerId={Number(customerId)} />
}
