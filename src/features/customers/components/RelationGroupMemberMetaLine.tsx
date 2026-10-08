import { formatCustomerBirthDateDot, formatCustomerGenderReadLabel } from '../utils/customerDisplayFormat'
import { CustomerGenderText } from './CustomerGenderText'

type Props = {
  relationshipLabel?: string | null
  gender?: 'male' | 'female' | null
  birthDate?: string | Date | null
}

/** 가족 그룹 구성원 meta — 성별만 Native 색상 적용 */
export function RelationGroupMemberMetaLine({ relationshipLabel, gender, birthDate }: Props) {
  const relation = String(relationshipLabel ?? '').trim() || '관계 미지정'
  const genderLabel = formatCustomerGenderReadLabel(gender ?? null, null)
  const birth = formatCustomerBirthDateDot(birthDate ?? null)

  return (
    <span className="customer-relation-group-member__meta">
      <span>{relation}</span>
      {genderLabel && genderLabel !== '-' ? (
        <>
          <span aria-hidden> · </span>
          <CustomerGenderText gender={gender ?? null} />
        </>
      ) : null}
      {birth ? (
        <>
          <span aria-hidden> · </span>
          <span>{birth}</span>
        </>
      ) : null}
    </span>
  )
}
