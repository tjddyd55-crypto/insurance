import { useCallback, useState } from 'react'
import FormInput from '../../../components/form/FormInput'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import { PrintPortal } from './AccountPrintFlow'
import { buildAccountPrintData, type AccountPrintData, type PrintOrientation } from './accountPrintLayout'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

export function useAccountPrintFlow(accounts: readonly UserInsurerAccountRow[]) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [orientation, setOrientation] = useState<PrintOrientation>('landscape')
  const [data, setData] = useState<AccountPrintData | null>(null)
  // React releases the only print-data state on unmount; no cache or storage.
  const done = useCallback(() => setData(null), [])
  return {
    printing: data !== null,
    openPrint: () => { setOrientation('landscape'); setConfirmOpen(true) },
    printFlow: <>
      <ConfirmDialog
        open={confirmOpen}
        title="보험사 계정을 출력할까요?"
        message={<>
          {'출력물에는 보험사 아이디와 실제 비밀번호가 표시됩니다.\n출력물을 안전하게 보관해 주세요.'}
          <fieldset className="mt-4" role="radiogroup" aria-label="용지 방향">
            <legend className="mb-2 font-medium">용지 방향</legend>
            <div className="flex gap-4">
              {([{ value: 'landscape', label: '가로' }, { value: 'portrait', label: '세로' }] as const).map(option => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2">
                  <FormInput type="radio" name="account-print-orientation"
                    checked={orientation === option.value} onChange={() => setOrientation(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </>}
        confirmLabel="출력하기"
        cancelLabel="취소"
        closeOnBackdrop={false}
        closeOnEsc={false}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          setData(buildAccountPrintData(accounts, orientation))
        }}
      />
      {data && <PrintPortal data={data} onDone={done} />}
    </>,
  }
}
