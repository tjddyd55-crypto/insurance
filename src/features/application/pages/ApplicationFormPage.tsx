import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { useAuth } from '../../auth/AuthProvider'
import {
  CheckboxInput,
  SelectInput,
  TextAreaInput,
  TextInput,
} from '../components/FormFields'
import { FormSection } from '../components/FormSection'

type EditableField = keyof InsuranceApplicationFormData
const AUTO_SAVE_INTERVAL_MS = 5000

function normalizeFormData(source: Partial<InsuranceApplicationFormData>): InsuranceApplicationFormData {
  const normalized = createEmptyApplicationForm()
  const keys = Object.keys(normalized) as EditableField[]
  for (const key of keys) {
    const nextValue = source[key]
    if (typeof nextValue !== 'undefined') {
      ;(normalized as unknown as Record<string, string | boolean>)[key] =
        nextValue as string | boolean
    }
  }
  return normalized
}

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
  const location = useLocation()
  const { id } = useParams()
  const { token, user } = useAuth()

  const [recordId, setRecordId] = useState<string | undefined>(id)
  const [formData, setFormData] = useState<InsuranceApplicationFormData>(
    createEmptyApplicationForm(),
  )
  const [statusText, setStatusText] = useState('신청서 정보를 불러오는 중입니다.')
  const [isLoading, setIsLoading] = useState(true)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [lastSavedSignature, setLastSavedSignature] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)

    async function loadInitialData() {
      const mode = new URLSearchParams(location.search).get('mode')
      const shouldReadOnly = mode === 'readonly'

      if (id && token) {
        const record = await getApplicationById(id, token)
        if (record && active) {
          const normalized = normalizeFormData(record)
          setRecordId(record.id)
          setFormData(normalized)
          setIsReadOnly(shouldReadOnly)
          setStatusText(shouldReadOnly ? '신청서를 읽기 모드로 불러왔습니다.' : '신청서를 불러왔습니다.')
          setLastSavedSignature(JSON.stringify(normalized))
          setIsLoading(false)
          return
        }
      }

      const draft = getDraft(user?.id)
      if (draft && active) {
        const normalized = normalizeFormData(draft.data)
        setRecordId(draft.id)
        setFormData(normalized)
        setIsReadOnly(false)
        setStatusText('임시 저장본을 복원했습니다.')
        setLastSavedSignature(JSON.stringify(normalized))
        setIsLoading(false)
        return
      }

      if (!active) {
        return
      }

      const empty = createEmptyApplicationForm()
      setRecordId(undefined)
      setFormData(empty)
      setIsReadOnly(false)
      setStatusText('새 신청서를 작성 중입니다.')
      setLastSavedSignature(JSON.stringify(empty))
      setIsLoading(false)
    }

    void loadInitialData()
    return () => {
      active = false
    }
  }, [id, location.search, token, user?.id])

  useEffect(() => {
    if (isLoading || isReadOnly || !token) {
      return
    }

    const currentSignature = JSON.stringify(formData)
    if (currentSignature === lastSavedSignature) {
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const savedRecord = await saveApplication(formData, token, recordId)
        const normalized = normalizeFormData(savedRecord)
        setRecordId(savedRecord.id)
        setLastSavedSignature(JSON.stringify(normalized))
        const draft = saveDraft(normalized, user?.id, savedRecord.id)
        const savedText = new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(draft.savedAt))
        setStatusText(`자동 저장됨 (${savedText})`)
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : '자동 저장에 실패했습니다.')
      }
    }, AUTO_SAVE_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [formData, isLoading, isReadOnly, lastSavedSignature, recordId, token, user?.id])

  const updateField = (field: EditableField, value: string | boolean) => {
    if (isReadOnly) {
      return
    }

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
    if (isReadOnly) {
      return
    }

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

  const handleSave = async (
    mode: 'current' | 'new',
    options: { navigateToEdit?: boolean } = {},
  ) => {
    if (!token) {
      setStatusText('로그인이 필요합니다.')
      return
    }

    try {
      const savedRecord =
        mode === 'new'
          ? await saveApplicationAsNew(formData, token)
          : await saveApplication(formData, token, recordId)

      const normalized = normalizeFormData(savedRecord)
      setRecordId(savedRecord.id)
      setFormData(normalized)
      setLastSavedSignature(JSON.stringify(normalized))
      clearDraft()
      saveDraft(normalized, user?.id, savedRecord.id)
      setStatusText(mode === 'new' ? '새 신청서로 저장했습니다.' : '신청서를 저장했습니다.')
      if (options.navigateToEdit ?? true) {
        navigate(`/form/${savedRecord.id}/edit`, { replace: true })
      }
      return savedRecord
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '저장에 실패했습니다.')
      return null
    }
  }

  const handleViewResult = async () => {
    // 결과보기 진입 전 현재 폼을 항상 저장해 유효한 id를 확보한다.
    const saved = await handleSave('current', { navigateToEdit: false })
    if (saved) {
      navigate(`/form/result/${saved.id}`)
    }
  }

  const pageTitle = useMemo(() => {
    if (isReadOnly) {
      return '신청서 불러보기'
    }
    return recordId ? '신청서 수정' : '신청서 신규 작성'
  }, [isReadOnly, recordId])

  if (isLoading) {
    return (
      <main className="page">
        <header className="page-header">
          <h1>신청서 로딩 중</h1>
          <p>저장된 데이터를 확인하고 있습니다.</p>
        </header>
      </main>
    )
  }

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
          disabled={isReadOnly}
          onChange={(value) => updateField('branchName', value)}
        />
        <TextInput
          label="사원명"
          value={formData.staffName}
          disabled={isReadOnly}
          onChange={(value) => updateField('staffName', value)}
        />
        <TextInput
          label="만기일자"
          type="date"
          value={formData.expiryDate}
          disabled={isReadOnly}
          onChange={(value) => updateField('expiryDate', value)}
        />
        <SelectInput
          label="종류"
          value={formData.contractType}
          options={CONTRACT_TYPES}
          disabled={isReadOnly}
          onChange={(value) => updateField('contractType', value)}
        />
        <SelectInput
          label="용도"
          value={formData.usageType}
          options={USAGE_TYPES}
          disabled={isReadOnly}
          onChange={(value) => updateField('usageType', value)}
        />
        <SelectInput
          label="전계약사"
          value={formData.previousInsurer}
          options={PREVIOUS_INSURERS}
          disabled={isReadOnly}
          onChange={(value) => updateField('previousInsurer', value)}
        />
      </FormSection>

      <FormSection title="인적사항 - 등록증상 소유자">
        <TextInput
          label="이름"
          value={formData.ownerName}
          disabled={isReadOnly}
          onChange={(value) => updateField('ownerName', value)}
        />
        <TextInput
          label="휴대폰"
          value={formData.ownerPhone}
          inputMode="numeric"
          disabled={isReadOnly}
          onChange={(value) => updateField('ownerPhone', value)}
        />
        <TextInput
          label="주민번호"
          value={formData.ownerResidentNumber}
          inputMode="numeric"
          disabled={isReadOnly}
          onChange={(value) => updateField('ownerResidentNumber', value)}
        />
        <TextAreaInput
          label="주소"
          value={formData.ownerAddress}
          disabled={isReadOnly}
          onChange={(value) => updateField('ownerAddress', value)}
        />
      </FormSection>

      <FormSection title="인적사항 - 보험료 납입자">
        <CheckboxInput
          label="등록증상 소유자 정보와 보험료 납입자 정보가 동일"
          checked={formData.payerSameAsOwner}
          disabled={isReadOnly}
          onChange={handlePayerSameAsOwner}
          helperText="체크 시 이름/휴대폰/주민번호/주소를 자동 복사합니다."
        />
        <TextInput
          label="이름"
          value={formData.payerName}
          disabled={isReadOnly || formData.payerSameAsOwner}
          onChange={(value) => updateField('payerName', value)}
        />
        <TextInput
          label="휴대폰"
          value={formData.payerPhone}
          inputMode="numeric"
          disabled={isReadOnly || formData.payerSameAsOwner}
          onChange={(value) => updateField('payerPhone', value)}
        />
        <TextInput
          label="주민번호"
          value={formData.payerResidentNumber}
          inputMode="numeric"
          disabled={isReadOnly || formData.payerSameAsOwner}
          onChange={(value) => updateField('payerResidentNumber', value)}
        />
        <TextAreaInput
          label="주소"
          value={formData.payerAddress}
          disabled={isReadOnly || formData.payerSameAsOwner}
          onChange={(value) => updateField('payerAddress', value)}
        />
      </FormSection>

      <FormSection title="차량사항">
        <TextInput
          label="차량번호"
          value={formData.vehicleNumber}
          disabled={isReadOnly}
          onChange={(value) => updateField('vehicleNumber', value)}
        />
        <TextInput
          label="차명"
          value={formData.vehicleModel}
          disabled={isReadOnly}
          onChange={(value) => updateField('vehicleModel', value)}
        />
        <TextInput
          label="연식"
          value={formData.vehicleYear}
          inputMode="numeric"
          disabled={isReadOnly}
          onChange={(value) => updateField('vehicleYear', value)}
        />
        <SelectInput
          label="마일리지"
          value={formData.mileageYn}
          options={YES_NO_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('mileageYn', value)}
        />
        <SelectInput
          label="블랙박스"
          value={formData.blackboxYn}
          options={YES_NO_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('blackboxYn', value)}
        />
        <TextInput
          label="계좌번호"
          value={formData.bankAccount}
          disabled={isReadOnly}
          onChange={(value) => updateField('bankAccount', value)}
        />
        <TextAreaInput
          label="기타부속"
          value={formData.extraAccessories}
          disabled={isReadOnly}
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
          disabled={isReadOnly}
          onChange={(value) => updateField('propertyDamage', value)}
        />
        <SelectInput
          label="자손/자상"
          value={formData.personalInjury}
          options={PERSONAL_INJURY_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('personalInjury', value)}
        />
        <SelectInput
          label="무보험차상해"
          value={formData.uninsuredMotorist}
          options={UNINSURED_MOTORIST_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('uninsuredMotorist', value)}
        />
        <SelectInput
          label="자기차량손해"
          value={formData.ownVehicleDamage}
          options={OWN_VEHICLE_DAMAGE_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('ownVehicleDamage', value)}
        />
        <SelectInput
          label="긴급출동"
          value={formData.emergencyAssist}
          options={EMERGENCY_ASSIST_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('emergencyAssist', value)}
        />
        <SelectInput
          label="운전범위"
          value={formData.driverScope}
          options={DRIVER_SCOPE_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('driverScope', value)}
        />
        <SelectInput
          label="운전연령"
          value={formData.driverAge}
          options={DRIVER_AGE_OPTIONS}
          disabled={isReadOnly}
          onChange={(value) => updateField('driverAge', value)}
        />
      </FormSection>

      <FormSection title="운전자 정보">
        <TextInput
          label="지정 1인 운전자 이름"
          value={formData.designatedDriverName}
          disabled={isReadOnly}
          onChange={(value) => updateField('designatedDriverName', value)}
        />
        <TextInput
          label="지정 1인 운전자 주민번호"
          value={formData.designatedDriverResidentNumber}
          inputMode="numeric"
          disabled={isReadOnly}
          onChange={(value) => updateField('designatedDriverResidentNumber', value)}
        />
        <TextInput
          label="배우자/최저운전자 이름"
          value={formData.spouseOrMinDriverName}
          disabled={isReadOnly}
          onChange={(value) => updateField('spouseOrMinDriverName', value)}
        />
        <TextInput
          label="배우자/최저운전자 주민번호"
          value={formData.spouseOrMinDriverResidentNumber}
          inputMode="numeric"
          disabled={isReadOnly}
          onChange={(value) => updateField('spouseOrMinDriverResidentNumber', value)}
        />
      </FormSection>

      <FormSection title="경력자 / 메모">
        <TextInput
          label="경력1"
          value={formData.career1}
          disabled={isReadOnly}
          onChange={(value) => updateField('career1', value)}
        />
        <TextInput
          label="경력2"
          value={formData.career2}
          disabled={isReadOnly}
          onChange={(value) => updateField('career2', value)}
        />
        <TextAreaInput
          label="메모"
          value={formData.memo}
          disabled={isReadOnly}
          onChange={(value) => updateField('memo', value)}
        />
      </FormSection>

      <div className="sticky-actions">
        <button className="button" type="button" onClick={() => navigate('/my-forms')}>
          목록
        </button>
        <button className="button" type="button" onClick={() => navigate('/dashboard')}>
          대시보드
        </button>
        <button className="button button--primary" type="button" onClick={() => void handleViewResult()}>
          결과보기
        </button>
        {isReadOnly ? (
          <button className="button button--secondary" type="button" onClick={() => setIsReadOnly(false)}>
            수정 시작
          </button>
        ) : (
          <>
            <button className="button button--primary" type="button" onClick={() => void handleSave('current')}>
              저장
            </button>
            {recordId ? (
              <button className="button button--secondary" type="button" onClick={() => void handleSave('new')}>
                새로 저장
              </button>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
