import { ScenarioLibrarySelectView } from './ScenarioLibrarySelectView'

type Props = {
  layoutMode: 'preview-pc' | 'preview-mobile'
}

/** @deprecated use ScenarioLibrarySelectView */
export function ScenarioSelectPreviewView({ layoutMode }: Props) {
  return <ScenarioLibrarySelectView layoutMode={layoutMode} />
}
