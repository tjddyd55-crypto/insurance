import type { ScenarioEditorController } from '../hooks/useScenarioEditor'
import { CenterAxisCompareEditor } from '../components/center-timeline/CenterAxisCompareEditor'

type Props = { editor: ScenarioEditorController }

export function ScenarioEditorPcView({ editor }: Props) {
  return <CenterAxisCompareEditor editor={editor} variant="pc" />
}
