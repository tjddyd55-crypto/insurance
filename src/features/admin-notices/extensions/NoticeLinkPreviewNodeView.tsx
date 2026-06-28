import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'

export function NoticeLinkPreviewNodeView({ node, selected, editor, getPos }: NodeViewProps) {
  const url = String(node.attrs.url ?? '').trim()
  const title = String(node.attrs.title ?? url).trim()
  const description = String(node.attrs.description ?? '').trim()
  const image = String(node.attrs.image ?? '').trim()
  const domain = String(node.attrs.domain ?? '').trim()
  const align = String(node.attrs.align ?? 'left')

  const selectNode = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const pos = getPos()
    if (typeof pos !== 'number') {
      return
    }
    const { tr } = editor.view.state
    editor.view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)))
    editor.view.focus()
  }

  return (
    <NodeViewWrapper
      as="div"
      className={`admin-notice-link-preview${selected ? ' admin-notice-link-preview--selected' : ''}`}
      data-url={url}
      data-align={align}
      data-drag-handle
      onMouseDown={selectNode}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.preventDefault()}
      >
        {image ? <img src={image} alt="" draggable={false} /> : null}
        <div className="admin-notice-link-preview__body">
          <strong className="admin-notice-link-preview__title">{title || url}</strong>
          {description ? <p className="admin-notice-link-preview__description">{description}</p> : null}
          <span className="admin-notice-link-preview__domain">{domain}</span>
        </div>
      </a>
    </NodeViewWrapper>
  )
}
