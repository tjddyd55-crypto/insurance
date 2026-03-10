import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CONTRACT_TYPES,
  DRIVER_AGE_OPTIONS,
  DRIVER_SCOPE_OPTIONS,
  EMERGENCY_ASSIST_OPTIONS,
  OWN_VEHICLE_DAMAGE_OPTIONS,
  PERSONAL_INJURY_OPTIONS,
  PREVIOUS_INSURERS,
  PROPERTY_DAMAGE_OPTIONS,
  UNINSURED_MOTORIST_OPTIONS,
  USAGE_TYPES,
  YES_NO_OPTIONS,
} from '../domain/options'
import { createEmptyApplicationForm } from '../domain/defaults'
import type { InsuranceApplicationFormData } from '../domain/types'
import {
  clearDraft,
  getApplicationById,
  getDraft,
  saveApplication,
  saveApplicationAsNew,
  saveDraft,
} from '../repository/applicationRepository'
import {
  CheckboxInput,
  SelectInput,
  TextAreaInput,
  TextInput,
} from '../components/FormFields'
import { FormSection } from '../components/FormSection'

type EditableField = keyof InsuranceApplicationFormData

function syncPayerFields(source: InsuranceApplicationFormData): InsuranceApplicationFormData {
  return {
    ...source,
    payerName: source.ownerName,
    payerPhone: source.ownerPhone,
    payerResidentNumber: source.ownerResidentNumber,
    payerAddress: source.ownerAddress,
  }
}

export function ApplicationFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [recordId, setRecordId] = useState<string | undefined>(id)
  const [formData, setFormData] = useState<InsuranceApplicationFormData>(
    createEmptyApplicationForm(),
  )
  const [statusText, setStatusText] = useState('작성 전')

  useEffect(() => {
    if (id) {
      const record = getApplicationById(id)
      if (record) {
        setRecordId(record.id)
        setFormData(record)
        setStatusText('저장된 신청서를 불러왔습니다.')
        return
      }
    }

    const draft = getDraft()
    if (draft) {
      setRecordId(draft.id)
      setFormData(draft.data)
      setStatusText('임시 저장본을 복원했습니다.')
      return
    }

    setRecordId(undefined)
    setFormData(createEmptyApplicationForm())
    setStatusText('새 신청서를 작성 중입니다.')
  }, [id])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const draft = saveDraft(formData, recordId)
      const savedText = new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(draft.savedAt))
      setStatusText(`임시 저장됨 (${savedText})`)
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [formData, recordId])

  const updateField = (field: EditableField, value: string | boolean) => {
    setFormData((previous) => {
      const nextValue = {
        ...previous,
        [field]: value,
      } as InsuranceApplicationFormData

      const ownerFields: EditableField[] = [
        'ownerName',
        'ownerPhone',
        'ownerResidentNumber',
        'ownerAddress',
      ]
      if (previous.payerSameAsOwner && ownerFields.includes(field)) {
        return syncPayerFields(nextValue)
      }

      return nextValue
    })
  }

  const handlePayerSameAsOwner = (checked: boolean) => {
    setFormData((previous) => {
      if (!checked) {
        return {
          ...previous,
          payerSameAsOwner: false,
        }
      }

      return syncPayerFields({
        ...previous,
        payerSameAsOwner: true,
      })
    })
  }

  const handleSave = (mode: 'current' | 'new') => {
    const savedRecord =
      mode === 'current'
        ? saveApplication(formData, recordId)
        : saveApplicationAsNew(formData)

    setRecordId(savedRecord.id)
    clearDraft()
    setStatusText(
      mode === 'current'
        ? '기존 신청서에 저장했습니다.'
        : '새 신청서로 저장했습니다.',
    )

    navigate(`/applications/${savedRecord.id}/edit`, { replace: true })
  }

  const handleViewResult = () => {
    const savedRecord = saveApplication(formData, recordId)
    setRecordId(savedRecord.id)
    clearDraft()
    navigate(`/applications/${savedRecord.id}/result`)
  }

  const pageTitle = useMemo(() => {
    return recordId ? '신청서 수정' : '신청서 신규 작성'
  }, [recordId])

  return (
    <main className="page">
      <header className="page-header">
        <h1>{pageTitle}</h1>
        <p>{statusText}</p>
      </header>

      <FormSection title="기본 정보">
        <TextInput
          label="지점명"
          value={formData.branchName}
          onChange={(value) => updateField('branchName', value)}
        />
        <TextInput
          label="사원명"
          value={formData.staffName}
          onChange={(value) => updateField('staffName', value)}
        />
        <TextInput
          label="만기일자"
          type="date"
          value={formData.expiryDate}
          onChange={(value) => updateField('expiryDate', value)}
        />
        <SelectInput
          label="종류"
          value={formData.contractType}
          options={CONTRACT_TYPES}
          onChange={(value) => updateField('contractType', value)}
        />
        <SelectInput
          label="용도"
          value={formData.usageType}
          options={USAGE_TYPES}
          onChange={(value) => updateField('usageType', value)}
        />
        <SelectInput
          label="전계약사"
          value={formData.previousInsurer}
          options={PREVIOUS_INSURERS}
          onChange={(value) => updateField('previousInsurer', value)}
        />
      </FormSection>

      <FormSection title="인적사항 - 등록증상 소유자">
        <TextInput
          label="이름"
          value={formData.ownerName}
          onChange={(value) => updateField('ownerName', value)}
        />
        <TextInput
          label="휴대폰"
          value={formData.ownerPhone}
          inputMode="numeric"
          onChange={(value) => updateField('ownerPhone', value)}
        />
        <TextInput
          label="주민번호"
          value={formData.ownerResidentNumber}
          inputMode="numeric"
          onChange={(value) => updateField('ownerResidentNumber', value)}
        />
        <TextAreaInput
          label="주소"
          value={formData.ownerAddress}
          onChange={(value) => updateField('ownerAddress', value)}
        />
      </FormSection>

      <FormSection title="인적사항 - 보험료 납입자">
        <CheckboxInput
          label="등록증상 소유자 정보와 보험료 납입자 정보가 동일"
          checked={formData.payerSameAsOwner}
          onChange={handlePayerSameAsOwner}
          helperText="체크 시 이름/휴대폰/주민번호/주소를 자동 복사합니다."
        />
        <TextInput
          label="이름"
          value={formData.payerName}
          disabled={formData.payerSameAsOwner}
          onChange={(value) => updateField('payerName', value)}
        />
        <TextInput
          label="휴대폰"
          value={formData.payerPhone}
          inputMode="numeric"
          disabled={formData.payerSameAsOwner}
          onChange={(value) => updateField('payerPhone', value)}
        />
        <TextInput
          label="주민번호"
          value={formData.payerResidentNumber}
          inputMode="numeric"
          disabled={formData.payerSameAsOwner}
          onChange={(value) => updateField('payerResidentNumber', value)}
        />
        <TextAreaInput
          label="주소"
          value={formData.payerAddress}
          disabled={formData.payerSameAsOwner}
          onChange={(value) => updateField('payerAddress', value)}
        />
      </FormSection>

      <FormSection title="차량사항">
        <TextInput
          label="차량번호"
          value={formData.vehicleNumber}
          onChange={(value) => updateField('vehicleNumber', value)}
        />
        <TextInput
          label="차명"
          value={formData.vehicleModel}
          onChange={(value) => updateField('vehicleModel', value)}
        />
        <TextInput
          label="연식"
          value={formData.vehicleYear}
          inputMode="numeric"
          onChange={(value) => updateField('vehicleYear', value)}
        />
        <SelectInput
          label="마일리지"
          value={formData.mileageYn}
          options={YES_NO_OPTIONS}
          onChange={(value) => updateField('mileageYn', value)}
        />
        <SelectInput
          label="블랙박스"
          value={formData.blackboxYn}
          options={YES_NO_OPTIONS}
          onChange={(value) => updateField('blackboxYn', value)}
        />
        <TextInput
          label="계좌번호"
          value={formData.bankAccount}
          onChange={(value) => updateField('bankAccount', value)}
        />
        <TextAreaInput
          label="기타부속"
          value={formData.extraAccessories}
          onChange={(value) => updateField('extraAccessories', value)}
        />
      </FormSection>

      <FormSection title="담보사항">
        <TextInput label="대인배상Ⅰ" value="가입필수" onChange={() => undefined} disabled />
        <TextInput label="대인배상Ⅱ" value="무한" onChange={() => undefined} disabled />
        <SelectInput
          label="대물배상"
          value={formData.propertyDamage}
          options={PROPERTY_DAMAGE_OPTIONS}
          onChange={(value) => updateField('propertyDamage', value)}
        />
        <SelectInput
          label="자손/자상"
          value={formData.personalInjury}
          options={PERSONAL_INJURY_OPTIONS}
          onChange={(value) => updateField('personalInjury', value)}
        />
        <SelectInput
          label="무보험차상해"
          value={formData.uninsuredMotorist}
          options={UNINSURED_MOTORIST_OPTIONS}
          onChange={(value) => updateField('uninsuredMotorist', value)}
        />
        <SelectInput
          label="자기차량손해"
          value={formData.ownVehicleDamage}
          options={OWN_VEHICLE_DAMAGE_OPTIONS}
          onChange={(value) => updateField('ownVehicleDamage', value)}
        />
        <SelectInput
          label="긴급출동"
          value={formData.emergencyAssist}
          options={EMERGENCY_ASSIST_OPTIONS}
          onChange={(value) => updateField('emergencyAssist', value)}
        />
        <SelectInput
          label="운전범위"
          value={formData.driverScope}
          options={DRIVER_SCOPE_OPTIONS}
          onChange={(value) => updateField('driverScope', value)}
        />
        <SelectInput
          label="운전연령"
          value={formData.driverAge}
          options={DRIVER_AGE_OPTIONS}
          onChange={(value) => updateField('driverAge', value)}
        />
      </FormSection>

      <FormSection title="운전자 정보">
        <TextInput
          label="지정 1인 운전자 이름"
          value={formData.designatedDriverName}
          onChange={(value) => updateField('designatedDriverName', value)}
        />
        <TextInput
          label="지정 1인 운전자 주민번호"
          value={formData.designatedDriverResidentNumber}
          inputMode="numeric"
          onChange={(value) => updateField('designatedDriverResidentNumber', value)}
        />
        <TextInput
          label="배우자/최저운전자 이름"
          value={formData.spouseOrMinDriverName}
          onChange={(value) => updateField('spouseOrMinDriverName', value)}
        />
        <TextInput
          label="배우자/최저운전자 주민번호"
          value={formData.spouseOrMinDriverResidentNumber}
          inputMode="numeric"
          onChange={(value) => updateField('spouseOrMinDriverResidentNumber', value)}
        />
      </FormSection>

      <FormSection title="경력자 / 메모">
        <TextInput
          label="경력1"
          value={formData.career1}
          onChange={(value) => updateField('career1', value)}
        />
        <TextInput
          label="경력2"
          value={formData.career2}
          onChange={(value) => updateField('career2', value)}
        />
        <TextAreaInput
          label="메모"
          value={formData.memo}
          onChange={(value) => updateField('memo', value)}
        />
      </FormSection>

      <div className="sticky-actions">
        <button className="button button--primary" type="button" onClick={() => handleSave('current')}>
          저장
        </button>
        <button className="button" type="button" onClick={handleViewResult}>
          결과보기
        </button>
        {recordId ? (
          <button className="button button--secondary" type="button" onClick={() => handleSave('new')}>
            새로 저장
          </button>
        ) : null}
      </div>
    </main>
  )
}
