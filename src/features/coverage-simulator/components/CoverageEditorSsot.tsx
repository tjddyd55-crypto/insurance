import type { CoverageSimulatorLayoutMode } from '../CoverageSimulatorScope'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { CenterAxisCompareEditor } from './center-timeline/CenterAxisCompareEditor'
import type { TimelineEditorController } from './center-timeline/TimelineEditorController'

/** Standalone / 3-pane / 고객 상세 — 동일 variant 규칙 */
export function resolveCoverageEditorVariant(layoutMode: CoverageSimulatorLayoutMode): 'mobile' | 'pc' {
  return layoutMode === 'preview-pc' ? 'pc' : 'mobile'
}

type Props = {
  editor: TimelineEditorController
}

/** 보장분석 Editor UI SSOT — wrapper만 context별로 다르게 둔다 */
export function CoverageEditorSsot({ editor }: Props) {
  const { layoutMode } = useCoverageSimulatorScope()
  const variant = resolveCoverageEditorVariant(layoutMode)
  return <CenterAxisCompareEditor editor={editor} variant={variant} />
}
