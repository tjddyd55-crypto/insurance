import { useScenarioEditor } from '../hooks/useScenarioEditor'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { ScenarioEditorMobileView } from './ScenarioEditorMobileView'
import { ScenarioEditorPcView } from './ScenarioEditorPcView'

export function ScenarioEditorPage() {
  const { layoutMode } = useCoverageSimulatorScope()
  const editor = useScenarioEditor()

  if (layoutMode === 'preview-pc') {
    return <ScenarioEditorPcView editor={editor} />
  }

  return <ScenarioEditorMobileView editor={editor} />
}
