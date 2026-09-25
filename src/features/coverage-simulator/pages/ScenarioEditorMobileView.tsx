import { CenterAxisCompareEditor } from '../components/center-timeline/CenterAxisCompareEditor'
import type { ScenarioEditorController } from '../hooks/useScenarioEditor'

type Props = { editor: ScenarioEditorController }

export function ScenarioEditorMobileView({ editor }: Props) {
  return <CenterAxisCompareEditor editor={editor} variant="mobile" />
}
