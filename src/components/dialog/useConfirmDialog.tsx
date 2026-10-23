import { useCallback, useEffect, useState, type ReactNode } from 'react'
import FormButton from '../form/FormButton'
import FormInput from '../form/FormInput'
import { ConfirmDialog } from './ConfirmDialog'
import { FormDialog } from './FormDialog'

type ConfirmRequest = {
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  hideCancel?: boolean
}

type PendingConfirm = ConfirmRequest & {
  resolve: (value: boolean) => void
}

type PromptRequest = {
  title?: string
  message?: ReactNode
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
}

type PendingPrompt = PromptRequest & {
  resolve: (value: string | null) => void
}

/**
 * 사용자 확인·안내·입력은 이 훅만 쓴다.
 * window.alert/confirm/prompt 는 Electron 에서 닫힌 뒤 포인터가 잠기는 원인이 된다
 * (네이티브 모달이 창의 히트 테스트를 복구하지 않음). 공통 다이얼로그는 포털을
 * 언마운트할 때 오버레이·포커스를 함께 걷어 그 잔여 상태를 만들지 않는다.
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [promptPending, setPromptPending] = useState<PendingPrompt | null>(null)
  const [promptDraft, setPromptDraft] = useState('')

  const closeWith = useCallback((result: boolean) => {
    setPending((current) => {
      if (!current) {
        return null
      }
      current.resolve(result)
      return null
    })
  }, [])

  const closePrompt = useCallback((value: string | null) => {
    setPromptPending((current) => {
      if (!current) {
        return null
      }
      current.resolve(value)
      return null
    })
  }, [])

  const confirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setPending({
        ...request,
        resolve,
      })
    })
  }, [])

  const alert = useCallback(
    (message: ReactNode, title = '안내') => {
      return confirm({
        title,
        message,
        confirmLabel: '확인',
        hideCancel: true,
      }).then(() => undefined)
    },
    [confirm],
  )

  const prompt = useCallback((request: PromptRequest) => {
    return new Promise<string | null>((resolve) => {
      setPromptDraft(request.defaultValue ?? '')
      setPromptPending({
        ...request,
        resolve,
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      setPending((current) => {
        if (current) {
          current.resolve(false)
        }
        return null
      })
      setPromptPending((current) => {
        if (current) {
          current.resolve(null)
        }
        return null
      })
    }
  }, [])

  const confirmDialog = (
    <>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title}
        message={pending?.message ?? ''}
        confirmLabel={pending?.confirmLabel}
        cancelLabel={pending?.cancelLabel}
        tone={pending?.tone ?? 'default'}
        hideCancel={pending?.hideCancel ?? false}
        onConfirm={() => closeWith(true)}
        onCancel={() => closeWith(false)}
      />
      <FormDialog
        open={promptPending != null}
        title={promptPending?.title ?? '입력'}
        onClose={() => closePrompt(null)}
        closeOnBackdrop={false}
        closeOnEsc={false}
        showCloseButton={false}
        footer={
          <>
            <FormButton variant="secondary" onClick={() => closePrompt(null)}>
              {promptPending?.cancelLabel ?? '취소'}
            </FormButton>
            <FormButton variant="primary" onClick={() => closePrompt(promptDraft)}>
              {promptPending?.confirmLabel ?? '확인'}
            </FormButton>
          </>
        }
      >
        {promptPending?.message ? (
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{promptPending.message}</p>
        ) : null}
        <FormInput
          value={promptDraft}
          onChange={(event) => setPromptDraft(event.target.value)}
          aria-label={promptPending?.title ?? '입력'}
        />
      </FormDialog>
    </>
  )

  return {
    confirm,
    alert,
    prompt,
    confirmDialog,
  }
}
