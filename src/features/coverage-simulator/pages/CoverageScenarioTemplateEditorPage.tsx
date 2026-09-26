import { CenterAxisCompareEditor } from '../components/center-timeline/CenterAxisCompareEditor'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { useTemplateEditor } from '../hooks/useTemplateEditor'

export function CoverageScenarioTemplateEditorPage() {
  const { layoutMode } = useCoverageSimulatorScope()
  const editor = useTemplateEditor()
  const variant = layoutMode === 'preview-pc' ? 'pc' : 'mobile'
  return <CenterAxisCompareEditor editor={editor} variant={variant} />
}
