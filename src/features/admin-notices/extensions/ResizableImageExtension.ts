import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ResizableImageNodeView } from './ResizableImageNodeView'

const NOTICE_ALIGNMENTS = ['left', 'center', 'right']

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
      align: {
        default: 'left',
        parseHTML: (element) => {
          const align = element.getAttribute('data-align')
          return NOTICE_ALIGNMENTS.includes(String(align)) ? align : 'left'
        },
        renderHTML: (attributes) => ({
          'data-align': NOTICE_ALIGNMENTS.includes(String(attributes.align)) ? attributes.align : 'left',
        }),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView)
  },
})
