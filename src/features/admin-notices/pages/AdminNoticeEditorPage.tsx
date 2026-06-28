import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FormButton, FormInput } from '../../../components/form'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { useAuth } from '../../auth/AuthProvider'
import {
  createAdminNotice,
  fetchAdminNotice,
  updateAdminNotice,
  uploadAdminNoticeImage,
} from '../api/adminNoticesApi'
import { AdminNoticeHtmlPreview, AdminNoticeRichEditor } from '../components/AdminNoticeRichEditor'
import {
  adminNoticeToForm,
  emptyAdminNoticeForm,
  type AdminNoticeFormState,
} from '../types/adminNotice.types'

export default function AdminNoticeEditorPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const params = useParams()
  const noticeId = params.id && params.id !== 'new' ? Number(params.id) : null
  const isEdit = noticeId != null && Number.isFinite(noticeId) && noticeId > 0

  const [form, setForm] = useState<AdminNoticeFormState>(emptyAdminNoticeForm())
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!isEdit || !token?.trim() || noticeId == null) {
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const notice = await fetchAdminNotice(token, noticeId)
        if (!cancelled) {
          setForm(adminNoticeToForm(notice))
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[admin-notices] failed to load notice', e)
          setError('공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, noticeId, token])

  const handleUploadImage = useCallback(
    async (file: File) => {
      if (!token?.trim()) {
        throw new Error('로그인이 필요합니다.')
      }
      return uploadAdminNoticeImage(token, file, isEdit ? noticeId : null)
    },
    [isEdit, noticeId, token],
  )

  const save = async (nextStatus: AdminNoticeFormState['status']) => {
    if (!token?.trim()) {
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, status: nextStatus }
      if (isEdit && noticeId != null) {
        const saved = await updateAdminNotice(token, noticeId, payload)
        if (!saved?.id) {
          throw new Error('공지 저장 결과에 ID가 없습니다.')
        }
        navigate('/admin/notices')
        return
      }
      const created = await createAdminNotice(token, payload)
      if (!created?.id) {
        throw new Error('공지 저장 결과에 ID가 없습니다.')
      }
      navigate(nextStatus === 'published' ? '/admin/notices' : `/admin/notices/${created.id}`)
    } catch (e) {
      console.error('[admin-notices] failed to save notice', e)
      setError('공지사항 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = useMemo(() => (isEdit ? '공지 수정' : '공지 작성'), [isEdit])

  return (
    <main className="page admin-notices-page admin-notices-page--pc page--with-back content-wrapper page-shell">
      <header className="admin-notices-page__header">
        <h1>{pageTitle}</h1>
        <p className="admin-notices-page__desc">네이버 글쓰기처럼 본문에서 텍스트와 이미지를 자유롭게 작성할 수 있습니다.</p>
      </header>

      {loading ? <p className="admin-notices-page__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="admin-notices-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading ? (
        <div className="admin-notices-editor">
          <label className="admin-notices-editor__field">
            <span>제목</span>
            <FormInput
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="공지 제목"
              disabled={saving}
            />
          </label>

          <section className="admin-notices-editor__section">
            <h2>본문</h2>
            <AdminNoticeRichEditor
              value={form.contentHtml}
              disabled={saving}
              onChange={(contentHtml) => setForm((prev) => ({ ...prev, contentHtml }))}
              onUploadImage={handleUploadImage}
            />
          </section>

          <section className="admin-notices-editor__section admin-notices-editor__options">
            <label className="admin-notices-editor__checkbox">
              <input
                type="checkbox"
                checked={form.showAsPopup}
                onChange={(event) => setForm((prev) => ({ ...prev, showAsPopup: event.target.checked }))}
                disabled={saving}
              />
              <span>첫 화면 팝업으로 표시</span>
            </label>
            <label className="admin-notices-editor__field">
              <span>팝업 우선순위</span>
              <FormInput
                type="number"
                value={String(form.popupPriority)}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, popupPriority: Number(event.target.value) || 0 }))
                }
                disabled={saving}
              />
            </label>
            <label className="admin-notices-editor__field">
              <span>게시 시작</span>
              <FormInput
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                disabled={saving}
              />
            </label>
            <label className="admin-notices-editor__field">
              <span>게시 종료</span>
              <FormInput
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                disabled={saving}
              />
            </label>
          </section>

          <div className="admin-notices-editor__footer">
            <Link to="/admin/notices">
              <FormButton htmlType="button" variant="secondary" disabled={saving}>
                목록
              </FormButton>
            </Link>
            <FormButton htmlType="button" variant="secondary" disabled={saving} onClick={() => setPreviewOpen(true)}>
              미리보기
            </FormButton>
            <FormButton htmlType="button" variant="secondary" disabled={saving} onClick={() => void save('draft')}>
              임시저장
            </FormButton>
            <FormButton htmlType="button" variant="primary" disabled={saving} onClick={() => void save('published')}>
              게시
            </FormButton>
          </div>
        </div>
      ) : null}

      <BaseDialog open={previewOpen} onClose={() => setPreviewOpen(false)} ariaLabel="공지 미리보기" panelPreset="largeForm">
        <div className="admin-notices-preview-modal">
          <header className="admin-notices-preview-modal__header">
            <h2>{form.title || '제목 없음'}</h2>
          </header>
          <div className="admin-notices-preview-modal__body">
            <AdminNoticeHtmlPreview html={form.contentHtml} />
          </div>
          <footer className="admin-notices-preview-modal__footer">
            <FormButton htmlType="button" variant="secondary" onClick={() => setPreviewOpen(false)}>
              닫기
            </FormButton>
          </footer>
        </div>
      </BaseDialog>
    </main>
  )
}
