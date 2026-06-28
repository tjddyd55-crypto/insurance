import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ResizableImageNodeView } from './ResizableImageNodeView'

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const widthAttr = element.getAttribute('width')
          if (widthAttr) {
            return widthAttr.replace(/px$/i, '')
          }
          const styleWidth = element.style.width
          if (styleWidth) {
            return styleWidth.replace(/px$/i, '')
          }
          return null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {}
          }
          const width = String(attributes.width).replace(/px$/i, '')
          return {
            width,
            style: `width: ${width}px; max-width: 100%; height: auto;`,
          }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView)
  },
})
