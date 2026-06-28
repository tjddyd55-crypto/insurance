import { Extension } from '@tiptap/core'
import { Color } from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { sanitizeAdminNoticeHtml } from '../utils/sanitizeAdminNoticeHtml'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {}
              }
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px']
const TEXT_COLORS = ['#111827', '#2563EB', '#EF4444', '#16A34A', '#F59E0B', '#7C3AED']

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  onUploadImage: (file: File) => Promise<string>
}

function ToolbarButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`admin-notices-rich-editor__tool${active ? ' admin-notices-rich-editor__tool--active' : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function AdminNoticeRichEditor({ value, onChange, disabled = false, onUploadImage }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      FontSize,
    ],
    content: value || '<p></p>',
    editable: !disabled,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) {
      return
    }
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) {
    return null
  }

  const runImageUpload = async (file: File | null) => {
    if (!file) {
      return
    }
    try {
      const publicUrl = await onUploadImage(file)
      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run()
    } catch (error) {
      console.error('[admin-notices] image upload failed', error)
      window.alert('이미지 업로드에 실패했습니다.')
    }
  }

  const setLink = () => {
    const { from, to } = editor.state.selection
    const hasSelection = from !== to
    const previousUrl = String(editor.getAttributes('link').href ?? '')
    const url = window.prompt('링크 URL', previousUrl || 'https://')
    if (url == null) {
      return
    }
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    if (hasSelection) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: trimmedUrl, target: '_blank', rel: 'noopener noreferrer' })
        .run()
      return
    }

    const label = window.prompt('링크 텍스트', trimmedUrl)
    if (label == null || !label.trim()) {
      return
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: label.trim(),
        marks: [{ type: 'link', attrs: { href: trimmedUrl, target: '_blank', rel: 'noopener noreferrer' } }],
      })
      .run()
  }

  return (
    <div className="admin-notices-rich-editor">
      <div className="admin-notices-rich-editor__toolbar">
        <label className="admin-notices-rich-editor__select-wrap">
          <span className="admin-notices-rich-editor__select-label">글자크기</span>
          <select
            className="admin-notices-rich-editor__select"
            disabled={disabled}
            defaultValue=""
            onChange={(event) => {
              const size = event.target.value
              if (!size) {
                editor.chain().focus().unsetFontSize().run()
              } else {
                editor.chain().focus().setFontSize(size).run()
              }
            }}
          >
            <option value="">기본</option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-notices-rich-editor__colors">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="admin-notices-rich-editor__color"
              style={{ backgroundColor: color }}
              disabled={disabled}
              title={`색상 ${color}`}
              onClick={() => editor.chain().focus().setColor(color).run()}
            />
          ))}
        </div>

        <ToolbarButton
          active={editor.isActive('bold')}
          disabled={disabled}
          title="굵게"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          disabled={disabled}
          title="기울임"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          disabled={disabled}
          title="밑줄"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          disabled={disabled}
          title="취소선"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          S
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'left' })}
          disabled={disabled}
          title="왼쪽 정렬"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          좌
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'center' })}
          disabled={disabled}
          title="가운데 정렬"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          중
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'right' })}
          disabled={disabled}
          title="오른쪽 정렬"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          우
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          disabled={disabled}
          title="글머리 목록"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          disabled={disabled}
          title="번호 목록"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton disabled={disabled} title="URL 링크" onClick={setLink}>
          링크
        </ToolbarButton>
        <ToolbarButton disabled={disabled} title="이미지 첨부" onClick={() => fileInputRef.current?.click()}>
          이미지
        </ToolbarButton>
        <ToolbarButton disabled={disabled} title="되돌리기" onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </ToolbarButton>
        <ToolbarButton disabled={disabled} title="다시 실행" onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="admin-notices-rich-editor__content" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          event.currentTarget.value = ''
          void runImageUpload(file)
        }}
      />
    </div>
  )
}

export function AdminNoticeHtmlPreview({ html }: { html: string }) {
  const sanitized = sanitizeAdminNoticeHtml(html)
  return (
    <div
      className="admin-notice-popup__content admin-notices-rich-editor__preview"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
