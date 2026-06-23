import { FormButton } from '../../../../components/form'
import Modal from '../../../../components/ui/Modal'
import type { CustomerRecord } from '../../domain/types'
import StorageWorkspace from '../../../storage/components/StorageWorkspace'

type CustomerFilesPageMobileProps = {
  token: string
  customerId: number
  customerTitle: string
  pickerOpen: boolean
  customers: CustomerRecord[]
  onOpenPicker: () => void
  onClosePicker: () => void
  onSelectCustomer: (id: number, name: string) => void
  onGoFiles: () => void
  onGoConsults: () => void
}

export default function CustomerFilesPageMobile({
  token,
  customerId,
  customerTitle,
  pickerOpen,
  customers,
  onOpenPicker,
  onClosePicker,
  onSelectCustomer,
  onGoFiles,
  onGoConsults,
}: CustomerFilesPageMobileProps) {
  const headerSlot = (
    <div className="storage-customer-header">
      <>
        <FormButton htmlType="button" variant="secondary" onClick={onOpenPicker}>
          {customerTitle} ▼
        </FormButton>
        <Modal
          open={pickerOpen}
          onClose={onClosePicker}
          ariaLabel="고객 선택"
          panelClassName="storage-folder-sheet"
        >
          <header className="storage-folder-sheet__header">
            <h2 className="storage-folder-sheet__title">고객 선택</h2>
          </header>
          <div className="storage-folder-sheet__body">
            <div className="storage-folder-sheet__list" role="listbox" aria-label="고객 목록">
            {customers.map((customer) => {
              const active = customer.id === customerId
              return (
                <button
                  key={customer.id}
                  type="button"
                  className={`ui-button ui-button--md ui-button--full ${active ? 'ui-button--primary' : 'ui-button--secondary'}`}
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelectCustomer(customer.id, customer.name)}
                >
                  {customer.name}
                </button>
              )
            })}
            </div>
          </div>
        </Modal>
      </>
      <div className="storage-customer-header__tabs">
        <FormButton htmlType="button" variant="primary" onClick={onGoFiles}>
          고객 파일
        </FormButton>
        <FormButton htmlType="button" variant="secondary" onClick={onGoConsults}>
          상담 이력
        </FormButton>
      </div>
    </div>
  )

  return (
    <StorageWorkspace
      token={token}
      customerId={customerId}
      title=""
      subtitle={undefined}
      headerSlot={headerSlot}
      variant="mobile"
    />
  )
}
