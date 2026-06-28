import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback } from 'react'

export function ResizableImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const widthValue = node.attrs.width ? Number(node.attrs.width) : null
  const imageStyle =
    widthValue && Number.isFinite(widthValue) && widthValue > 0
      ? { width: `${widthValue}px`, maxWidth: '100%', height: 'auto' }
      : { maxWidth: '100%', height: 'auto' }

  const onResizeStart = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const image = event.currentTarget.parentElement?.querySelector('img')
      if (!image) {
        return
      }
      const startX = event.clientX
      const startWidth = image.getBoundingClientRect().width

      const onMove = (moveEvent: MouseEvent) => {
        const nextWidth = Math.max(80, Math.min(900, startWidth + (moveEvent.clientX - startX)))
        updateAttributes({ width: Math.round(nextWidth) })
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [updateAttributes],
  )

  return (
    <NodeViewWrapper
      as="div"
      className={`admin-notices-rich-editor__image-wrap${
        selected ? ' admin-notices-rich-editor__image-wrap--selected' : ''
      }`}
      data-align={String(node.attrs.align ?? 'left')}
      data-drag-handle
    >
      <img
        src={String(node.attrs.src ?? '')}
        alt={String(node.attrs.alt ?? '')}
        data-align={String(node.attrs.align ?? 'left')}
        style={imageStyle}
        draggable={false}
      />
      {selected ? (
        <span
          className="admin-notices-rich-editor__image-resize-handle"
          role="presentation"
          onMouseDown={onResizeStart}
        />
      ) : null}
    </NodeViewWrapper>
  )
}
