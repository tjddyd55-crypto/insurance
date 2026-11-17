import { useCallback, useState } from 'react'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import { PrintPortal } from './AccountPrintFlow'
import { buildAccountPrintData, type AccountPrintData } from './accountPrintLayout'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

export function useAccountPrintFlow(accounts: readonly UserInsurerAccountRow[]) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [data, setData] = useState<AccountPrintData | null>(null)
  // React releases the only print-data state on unmount; no cache or storage.
  const done = useCallback(() => setData(null), [])
  return {
    printing: data !== null,
    openPrint: () => setConfirmOpen(true),
    printFlow: <>
      <ConfirmDialog
        open={confirmOpen}
        title="보험사 계정을 출력할까요?"
        message={'출력물에는 보험사 아이디와 실제 비밀번호가 표시됩니다.\n출력물을 안전하게 보관해 주세요.'}
        confirmLabel="출력하기"
        cancelLabel="취소"
        closeOnBackdrop={false}
        closeOnEsc={false}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          setData(buildAccountPrintData(accounts))
        }}
      />
      {data && <PrintPortal data={data} onDone={done} />}
    </>,
  }
}
