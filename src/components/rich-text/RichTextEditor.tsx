import { useEffect, useRef } from 'react'
import { sanitizeRichTextHtml } from './richText'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const COLOR_OPTIONS = [
  { label: '검정', value: '#111827' },
  { label: '빨강', value: '#dc2626' },
  { label: '파랑', value: '#2563eb' },
  { label: '초록', value: '#059669' },
  { label: '노랑', value: '#d97706' },
]

function runCommand(command: string, value?: string) {
  document.execCommand(command, false, value)
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '내용을 입력해 주세요.',
  disabled = false,
  className = '',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const lastHtmlRef = useRef('')

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }
    const sanitized = sanitizeRichTextHtml(value)
    if (sanitized !== lastHtmlRef.current && editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized
      lastHtmlRef.current = sanitized
    }
  }, [value])

  const emitChange = () => {
    const editor = editorRef.current
    if (!editor) {
      return
    }
    const sanitized = sanitizeRichTextHtml(editor.innerHTML)
    lastHtmlRef.current = sanitized
    onChange(sanitized)
  }

  const exec = (command: string, commandValue?: string) => {
    if (disabled) {
      return
    }
    editorRef.current?.focus()
    runCommand(command, commandValue)
    emitChange()
  }

  return (
    <div className={`rich-text-editor ${className}`.trim()} data-disabled={disabled ? 'true' : 'false'}>
      <div className="rich-text-editor__toolbar" aria-label="글자 꾸미기 도구">
        <button type="button" onClick={() => exec('bold')} disabled={disabled}>굵게</button>
        <button type="button" onClick={() => exec('underline')} disabled={disabled}>밑줄</button>
        <button type="button" onClick={() => exec('foreColor', '#dc2626')} disabled={disabled}>빨강</button>
        <button type="button" onClick={() => exec('fontSize', '5')} disabled={disabled}>크게</button>
        <button type="button" onClick={() => exec('fontSize', '3')} disabled={disabled}>보통</button>
        <button type="button" onClick={() => exec('insertUnorderedList')} disabled={disabled}>목록</button>
        <select
          aria-label="글자 색상"
          disabled={disabled}
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) {
              exec('foreColor', event.target.value)
              event.target.value = ''
            }
          }}
        >
          <option value="">색상</option>
          {COLOR_OPTIONS.map((color) => (
            <option key={color.value} value={color.value}>{color.label}</option>
          ))}
        </select>
      </div>
      <div className="rich-text-editor__body-wrap">
        <div
          ref={editorRef}
          className="rich-text-editor__body"
          contentEditable={!disabled}
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          onPaste={(event) => {
            event.preventDefault()
            const text = event.clipboardData.getData('text/plain')
            document.execCommand('insertText', false, text)
            emitChange()
          }}
        />
      </div>
    </div>
  )
}
