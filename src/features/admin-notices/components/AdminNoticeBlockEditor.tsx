import { FormButton, FormInput, FormTextarea } from '../../../components/form'
import type { AdminNoticeContentBlock } from '../types/adminNotice.types'

type Props = {
  blocks: AdminNoticeContentBlock[]
  disabled?: boolean
  onChange: (blocks: AdminNoticeContentBlock[]) => void
  onUploadImage: (file: File) => Promise<{ storageKey: string; publicUrl: string; alt?: string }>
}

export function AdminNoticeBlockEditor({ blocks, disabled = false, onChange, onUploadImage }: Props) {
  const updateBlock = (index: number, next: AdminNoticeContentBlock) => {
    onChange(blocks.map((block, i) => (i === index ? next : block)))
  }

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index))
  }

  const addTextBlock = () => {
    onChange([...blocks, { type: 'text', text: '' }])
  }

  const addImageBlock = async (file: File | null) => {
    if (!file) {
      return
    }
    try {
      const uploaded = await onUploadImage(file)
      onChange([
        ...blocks,
        {
          type: 'image',
          url: uploaded.publicUrl,
          storageKey: uploaded.storageKey,
          alt: uploaded.alt ?? file.name,
        },
      ])
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.')
    }
  }

  return (
    <div className="admin-notices-block-editor">
      {blocks.map((block, index) => (
        <div key={`${block.type}-${index}`} className="admin-notices-block-editor__item">
          {block.type === 'text' ? (
            <FormTextarea
              value={block.text}
              onChange={(event) => updateBlock(index, { type: 'text', text: event.target.value })}
              placeholder="공지 텍스트"
              disabled={disabled}
              rows={4}
            />
          ) : (
            <div className="admin-notices-block-editor__image">
              <img src={block.url} alt={block.alt ?? '공지 이미지'} />
              <FormInput
                value={block.alt ?? ''}
                onChange={(event) =>
                  updateBlock(index, { ...block, alt: event.target.value })
                }
                placeholder="이미지 설명(선택)"
                disabled={disabled}
              />
            </div>
          )}
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => removeBlock(index)}
          >
            블록 삭제
          </FormButton>
        </div>
      ))}

      <div className="admin-notices-block-editor__actions">
        <FormButton htmlType="button" variant="secondary" size="sm" disabled={disabled} onClick={addTextBlock}>
          + 텍스트 추가
        </FormButton>
        <label className="admin-notices-block-editor__upload">
          <span>+ 이미지 추가</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              event.currentTarget.value = ''
              void addImageBlock(file)
            }}
          />
        </label>
      </div>
    </div>
  )
}

export function AdminNoticeBlockPreview({ blocks }: { blocks: AdminNoticeContentBlock[] }) {
  return (
    <div className="admin-notices-block-preview">
      {blocks.map((block, index) =>
        block.type === 'text' ? (
          <p key={`text-${index}`} className="admin-notices-block-preview__text">
            {block.text}
          </p>
        ) : (
          <figure key={`image-${index}`} className="admin-notices-block-preview__figure">
            <img src={block.url} alt={block.alt ?? ''} />
            {block.alt ? <figcaption>{block.alt}</figcaption> : null}
          </figure>
        ),
      )}
    </div>
  )
}
