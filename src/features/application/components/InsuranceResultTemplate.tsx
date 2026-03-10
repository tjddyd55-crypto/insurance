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
import type { InsuranceApplicationFormData } from '../domain/types'

interface InsuranceResultTemplateProps {
  data: InsuranceApplicationFormData
}

interface InlineOptionsProps {
  options: readonly string[]
  selected: string
  className?: string
}

function InlineOptions({ options, selected, className = '' }: InlineOptionsProps) {
  return (
    <div className={`inline-options ${className}`.trim()}>
      {options.map((option, index) => (
        <span key={option} className="inline-options__segment">
          {index > 0 ? <span className="inline-options__slash"> / </span> : null}
          <span
            className={`inline-options__item ${
              selected === option ? 'inline-options__item--selected' : ''
            }`}
          >
            {option}
          </span>
        </span>
      ))}
    </div>
  )
}

function valueText(input: string): string {
  return input.trim() || ' '
}

export function InsuranceResultTemplate({ data }: InsuranceResultTemplateProps) {
  return (
    <article className="result-template a4-page">
      <p className="paper-top-line">F. 053-218-4273</p>

      <table className="paper-table paper-table--main">
        <tbody>
          <tr className="h-381">
            <th className="w-1025 align-center v-center">지점명</th>
            <td className="w-4327 align-center v-center">{valueText(data.branchName)}</td>
            <th className="w-1025 align-center v-center">사원명</th>
            <td className="w-4596 align-center v-center">{valueText(data.staffName)}</td>
          </tr>
          <tr className="h-401">
            <th className="w-1025 align-center v-center">만기일자</th>
            <td className="w-1651 align-center v-center">{valueText(data.expiryDate)}</td>
            <th className="w-1025 align-left v-center">종류</th>
            <td className="w-1651 align-left v-center">
              <InlineOptions options={CONTRACT_TYPES} selected={data.contractType} />
            </td>
            <th className="w-1025 align-center v-center">용도</th>
            <td className="w-4596 align-left v-center">
              <InlineOptions options={USAGE_TYPES} selected={data.usageType} />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-1025 align-center v-center">전계약사</th>
            <td className="w-9948 align-center v-center" colSpan={5}>
              <InlineOptions
                options={PREVIOUS_INSURERS}
                selected={data.previousInsurer}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="paper-table paper-table--person">
        <tbody>
          <tr className="h-293">
            <th className="w-1025 align-left v-center">인적사항</th>
            <th className="w-9949 align-center v-center" colSpan={4}>
              등록증상 소유자
            </th>
          </tr>
          <tr className="h-421">
            <td className="w-1025 align-left v-center" />
            <th className="w-1025 align-center v-center">피보험자</th>
            <td className="w-3303 align-center v-center">{valueText(data.ownerName)}</td>
            <th className="w-1025 align-center v-center">휴대폰</th>
            <td className="w-4596 align-center v-center">{valueText(data.ownerPhone)}</td>
          </tr>
          <tr className="h-704">
            <td className="w-1025 align-left v-center" />
            <th className="w-1025 align-center v-center">주민번호</th>
            <td className="w-3303 align-center v-center">{valueText(data.ownerResidentNumber)}</td>
            <th className="w-1025 align-center v-center">주소</th>
            <td className="w-4596 multiline align-center">{valueText(data.ownerAddress)}</td>
          </tr>
          <tr className="h-313">
            <td className="w-1025 align-left v-center" />
            <th className="w-9949 align-center v-center" colSpan={4}>
              보험료 납입자
            </th>
          </tr>
          <tr className="h-421">
            <td className="w-1025 align-left v-center" />
            <th className="w-1025 align-center v-center">계약자</th>
            <td className="w-3303 align-center v-center">{valueText(data.payerName)}</td>
            <th className="w-1025 align-center v-center">휴대폰</th>
            <td className="w-4596 align-center v-center">{valueText(data.payerPhone)}</td>
          </tr>
          <tr className="h-684">
            <td className="w-1025 align-left v-center" />
            <th className="w-1025 align-center v-center">주민번호</th>
            <td className="w-3303 align-center v-center">{valueText(data.payerResidentNumber)}</td>
            <th className="w-1025 align-center v-center">주소</th>
            <td className="w-4596 multiline align-center">{valueText(data.payerAddress)}</td>
          </tr>
        </tbody>
      </table>

      <table className="paper-table paper-table--vehicle">
        <tbody>
          <tr className="h-401">
            <th className="w-1025 align-left v-center" rowSpan={4}>
              차량사항
            </th>
            <th className="w-1025 align-center v-center">차량번호</th>
            <td className="w-3303 align-center v-center">{valueText(data.vehicleNumber)}</td>
            <th className="w-1945 align-center v-center">마일리지</th>
            <td className="w-3678 align-right v-center">
              <InlineOptions options={YES_NO_OPTIONS} selected={data.mileageYn} />
            </td>
          </tr>
          <tr className="h-401">
            <th className="w-1025 align-center v-center">차명</th>
            <td className="w-3303 align-center v-center">{valueText(data.vehicleModel)}</td>
            <th className="w-1945 align-center v-center">블박</th>
            <td className="w-3678 align-right v-center">
              <InlineOptions options={YES_NO_OPTIONS} selected={data.blackboxYn} />
            </td>
          </tr>
          <tr className="h-401">
            <th className="w-1025 align-center v-center">연식</th>
            <td className="w-3303 align-center v-center">{valueText(data.vehicleYear)}</td>
            <th className="w-1945 align-center v-center">계좌번호</th>
            <td className="w-3678 align-center v-center">{valueText(data.bankAccount)}</td>
          </tr>
          <tr className="h-421">
            <th className="w-1025 align-center v-center">기타부속</th>
            <td className="w-8926 multiline align-center" colSpan={3}>
              {valueText(data.extraAccessories)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="paper-note">* 굵은선 안에 내용은 필히 기재해주셔야 합니다.</p>

      <table className="paper-table paper-table--coverage">
        <tbody>
          <tr className="h-421">
            <th className="w-10973 align-center v-center" colSpan={5}>
              담보사항
            </th>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              대인배상Ⅰ
            </th>
            <td className="w-8923 align-center v-center">
              가입필수 (사망 / 후유장애 최고 1.5억한도 / 부상 최고 3천 한도)
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              대인배상Ⅱ
            </th>
            <td className="w-8923 align-center v-center">무한</td>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              대물배상
            </th>
            <td className="w-8923 align-center v-center">
              <InlineOptions
                options={PROPERTY_DAMAGE_OPTIONS}
                selected={data.propertyDamage}
              />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              자손/자상
            </th>
            <td className="w-8923 align-left v-center">
              <InlineOptions
                options={PERSONAL_INJURY_OPTIONS}
                selected={data.personalInjury}
              />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              무보험차상해
            </th>
            <td className="w-8923 align-center v-center">
              <InlineOptions
                options={UNINSURED_MOTORIST_OPTIONS}
                selected={data.uninsuredMotorist}
              />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              자기차량손해
            </th>
            <td className="w-8923 align-center v-center">
              <InlineOptions
                options={OWN_VEHICLE_DAMAGE_OPTIONS}
                selected={data.ownVehicleDamage}
              />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              긴급출동
            </th>
            <td className="w-8923 align-center v-center">
              <InlineOptions
                options={EMERGENCY_ASSIST_OPTIONS}
                selected={data.emergencyAssist}
              />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-1025 align-left v-center">운전범위</th>
            <td className="w-9948 align-left v-center text-small" colSpan={4}>
              <InlineOptions
                options={DRIVER_SCOPE_OPTIONS}
                selected={data.driverScope}
                className="inline-options--tight"
              />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-1025 align-left v-center">운전연령</th>
            <td className="w-9948 align-left v-center" colSpan={4}>
              <InlineOptions options={DRIVER_AGE_OPTIONS} selected={data.driverAge} />
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-3701 align-left v-center" colSpan={3}>
              지정 1인 운전자 이름 & 주민번호
            </th>
            <td className="w-7272 align-center v-center" colSpan={2}>
              {valueText(data.designatedDriverName)}
              {data.designatedDriverResidentNumber
                ? ` / ${data.designatedDriverResidentNumber}`
                : ''}
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-3701 align-left v-center" colSpan={3}>
              배우자 / 최저운전자 이름 & 주민번호
            </th>
            <td className="w-7272 align-center v-center" colSpan={2}>
              {valueText(data.spouseOrMinDriverName)}
              {data.spouseOrMinDriverResidentNumber
                ? ` / ${data.spouseOrMinDriverResidentNumber}`
                : ''}
            </td>
          </tr>
          <tr className="h-421">
            <th className="w-2050 align-left v-center" colSpan={2}>
              경력자지정
            </th>
            <th className="w-4327 align-left v-center" colSpan={2}>
              경력1: {valueText(data.career1)}
            </th>
            <th className="w-4596 align-left v-center">경력2: {valueText(data.career2)}</th>
          </tr>
          <tr className="h-684">
            <th className="w-2050 align-left v-center" colSpan={2}>
              메모
            </th>
            <td className="w-8923 multiline align-left" colSpan={3}>
              {valueText(data.memo)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="paper-memo-label">MEMO</p>
    </article>
  )
}
