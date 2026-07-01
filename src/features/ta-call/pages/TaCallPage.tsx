import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useTaCallState, type TaCallViewProps } from '../hooks/useTaCallState'
import TaCallMobileView from './ta/TaCallMobileView'
import TaCallPCView from './ta/TaCallPCView'
import '../ta-call.css'

export default function TaCallPage() {
  const state = useTaCallState()
  const viewProps: TaCallViewProps = state
  return (
    <ResponsiveLayout<TaCallViewProps>
      PC={TaCallPCView}
      Mobile={TaCallMobileView}
      viewProps={viewProps}
    />
  )
}
