import { CoverageEditorSsot } from '../components/CoverageEditorSsot'
import type { ScenarioEditorController } from '../hooks/useScenarioEditor'

type Props = { editor: ScenarioEditorController }

export function ScenarioEditorMobileView({ editor }: Props) {
  return <CoverageEditorSsot editor={editor} />
}
