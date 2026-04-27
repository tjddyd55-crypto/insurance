import { type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { InsuranceInline } from '../../../components/customer/CustomerForm'
import {
  AddressSearchField,
  FormButton,
  FormInput,
  FormTextarea,
  type AddressSearchValue,
} from '../../../components/form'
import { CUSTOMER_MEDICAL_QUESTION_TEXT } from '../utils/customerDisplayFormat'
import type { CustomerEditFormState } from '../types/customerEditForm'
import { CustomerCarsEditor } from './CustomerCarsEditor'

type CustomerEditFormProps = {
  customerId: number
  editForm: CustomerEditFormState
  setEditForm: Dispatch<SetStateAction<CustomerEditFormState | null>>
  onEditSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  onCancelEdit: () => void
}

export default function CustomerEditForm({
  customerId,
  editForm,
  setEditForm,
  onEditSubmit,
  onCancelEdit,
}: CustomerEditFormProps) {
  return (
    <>
      <div className="customer-edit-banner" role="status">
        ✏ 고객 정보 수정 중
      </div>
      <form
        className="customer-edit-form"
        onSubmit={(e) => {
          void onEditSubmit(e)
        }}
      >
        <div className="field-grid-customers">
          <label className="field">
            <span className="field__label">이름</span>
            <FormInput
              className="field__control"
              name="customer-name"
              autoComplete="name"
              value={editForm.name ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
            />
          </label>
          <div className="field field--wide">
            <span className="field__label">성별</span>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>
              <label>
                <FormInput
                  type="radio"
                  name={`gender-edit-${customerId}`}
                  checked={editForm.gender === 'male'}
                  onChange={() =>
                    setEditForm((prev) => (prev ? { ...prev, gender: 'male' } : prev))
                  }
                />{' '}
                남
              </label>
              <label>
                <FormInput
                  type="radio"
                  name={`gender-edit-${customerId}`}
                  checked={editForm.gender === 'female'}
                  onChange={() =>
                    setEditForm((prev) => (prev ? { ...prev, gender: 'female' } : prev))
                  }
                />{' '}
                여
              </label>
            </div>
          </div>
          <label className="field">
            <span className="field__label">주민번호</span>
            <FormInput
              className="field__control"
              name="customer-ssn"
              autoComplete="off"
              value={editForm.ssn ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, ssn: e.target.value } : prev))
              }
            />
          </label>
          <InsuranceInline ssn={editForm.ssn ?? ''} />
          <label className="field">
            <span className="field__label">전화번호</span>
            <FormInput
              className="field__control"
              name="customer-phone"
              autoComplete="tel"
              value={editForm.phone ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
              }
            />
          </label>
          <div className="field field--wide">
            <span className="field__label">주소</span>
            <AddressSearchField
              className="address-search-field"
              value={{
                zonecode: editForm.zonecode ?? '',
                baseAddress: editForm.address ?? '',
                detailAddress: editForm.addressDetail ?? '',
              }}
              onChange={(next: AddressSearchValue) =>
                setEditForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        zonecode: next.zonecode,
                        address: next.baseAddress,
                        addressDetail: next.detailAddress,
                      }
                    : prev,
                )
              }
            />
          </div>
          <label className="field">
            <span className="field__label">키</span>
            <FormInput
              className="field__control"
              value={editForm.height ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, height: e.target.value } : prev))
              }
            />
          </label>
          <label className="field">
            <span className="field__label">몸무게</span>
            <FormInput
              className="field__control"
              value={editForm.weight ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, weight: e.target.value } : prev))
              }
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">직업 / 회사명 등</span>
            <FormInput
              className="field__control"
              value={editForm.job ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, job: e.target.value } : prev))
              }
            />
          </label>
          <div className="field field--wide">
            <span className="field__label">운전 여부</span>
            <div className="customer-driving-radio-group" role="radiogroup" aria-label="운전 여부">
              <label className="customer-driving-radio-option">
                <FormInput
                  type="radio"
                  name={`driver-edit-${customerId}`}
                  checked={editForm.isDriver === true}
                  onChange={() =>
                    setEditForm((prev) => (prev ? { ...prev, isDriver: true } : prev))
                  }
                />
                <span>운전함</span>
              </label>
              <label className="customer-driving-radio-option">
                <FormInput
                  type="radio"
                  name={`driver-edit-${customerId}`}
                  checked={editForm.isDriver === false}
                  onChange={() =>
                    setEditForm((prev) => (prev ? { ...prev, isDriver: false } : prev))
                  }
                />
                <span>운전 안함</span>
              </label>
            </div>
          </div>
          <CustomerCarsEditor
            cars={editForm.cars}
            onChange={(next) =>
              setEditForm((prev) => (prev ? { ...prev, cars: next } : prev))
            }
          />
          <label className="field field--wide">
            <span className="field__label">{CUSTOMER_MEDICAL_QUESTION_TEXT}</span>
            <FormTextarea
              className="field__control customer-textarea--medical-history"
              name="customer-medical"
              rows={5}
              placeholder="예: 2024-03 / 허리디스크 / 허리 / 시술 / 통원치료 / 사고 후 통증 / 치료 완료"
              value={editForm.medical ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, medical: e.target.value } : prev))
              }
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">보험가입내역</span>
            <FormTextarea
              className="field__control customer-textarea--insurance-history"
              name="customer-insurance-history"
              rows={5}
              placeholder="보험가입내역 입력"
              value={editForm.insuranceHistory ?? ''}
              onChange={(e) =>
                setEditForm((prev) => (prev ? { ...prev, insuranceHistory: e.target.value } : prev))
              }
            />
          </label>
        </div>
        <div className="customer-edit-actions">
          <FormButton className="button-save" htmlType="submit" variant="primary">
            수정 저장
          </FormButton>
          <FormButton
            className="button-cancel"
            htmlType="button"
            variant="secondary"
            onClick={onCancelEdit}
          >
            취소
          </FormButton>
        </div>
      </form>
    </>
  )
}
