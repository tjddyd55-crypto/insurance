import { CoverageEditorSsot } from '../components/CoverageEditorSsot'
import { useTemplateEditor } from '../hooks/useTemplateEditor'

export function CoverageScenarioTemplateEditorPage() {
  const editor = useTemplateEditor()
  return <CoverageEditorSsot editor={editor} />
}
