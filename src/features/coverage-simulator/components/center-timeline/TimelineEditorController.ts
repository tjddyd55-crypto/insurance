import type { ScenarioEditorController } from '../../hooks/useScenarioEditor'
import type { TemplateEditorController } from '../../hooks/useTemplateEditor'

export type TimelineEditorController = ScenarioEditorController | TemplateEditorController

export function isTemplateEditorMode(
  editor: TimelineEditorController,
): editor is TemplateEditorController {
  return editor.editorMode === 'template'
}
