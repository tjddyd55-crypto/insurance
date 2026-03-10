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

interface OptionLineProps {
  options: readonly string[]
  selected: string
}

function OptionLine({ options, selected }: OptionLineProps) {
  return (
    <span className="option-line">
      {options.map((option, index) => (
        <span key={option} className="option-line__segment">
          {index > 0 ? <span className="option-line__sep"> / </span> : null}
          <span
            className={`option ${selected === option ? 'selected' : ''}`.trim()}
          >
            {option}
          </span>
        </span>
      ))}
    </span>
  )
}

function valueText(input: string): string {
  return input.trim() || '\u00a0'
}

export function InsuranceResultTemplate({ data }: InsuranceResultTemplateProps) {
  return (
    <article className="insurance-form result-template">
      <header className="insurance-header">F. 053-218-4273</header>
      <div className="insurance-top-rule" />

      <table className="insurance-table basic-info-table">
        <colgroup>
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '110.07px' }} />
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '110.07px' }} />
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '306.4px' }} />
        </colgroup>
        <tbody>
          <tr className="h-basic-1">
            <th className="bg-major">지점명</th>
            <td colSpan={3} className="value-large">{valueText(data.branchName)}</td>
            <th className="bg-major">사원명</th>
            <td className="value-large">{valueText(data.staffName)}</td>
          </tr>
          <tr className="h-basic-2">
            <th className="bg-major">만기일자</th>
            <td>{valueText(data.expiryDate)}</td>
            <th className="bg-major left">종류</th>
            <td className="left">
              <OptionLine options={CONTRACT_TYPES} selected={data.contractType} />
            </td>
            <th className="bg-major">용도</th>
            <td className="left">
              <OptionLine options={USAGE_TYPES} selected={data.usageType} />
            </td>
          </tr>
          <tr className="h-basic-3">
            <th className="bg-major">전계약사</th>
            <td colSpan={5} className="left">
              <OptionLine options={PREVIOUS_INSURERS} selected={data.previousInsurer} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="insurance-table personal-info-table">
        <colgroup>
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '220.2px' }} />
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '306.4px' }} />
        </colgroup>
        <tbody>
          <tr className="h-person-1">
            <th rowSpan={6} className="bg-major section-cell">인적사항</th>
            <th colSpan={4} className="bg-major">등록증상 소유자</th>
          </tr>
          <tr className="h-person-2">
            <th className="bg-minor">피보험자</th>
            <td>{valueText(data.ownerName)}</td>
            <th className="bg-minor">휴대폰</th>
            <td>{valueText(data.ownerPhone)}</td>
          </tr>
          <tr className="h-person-3">
            <th className="bg-minor">주민번호</th>
            <td>{valueText(data.ownerResidentNumber)}</td>
            <th className="bg-minor">주소</th>
            <td className="left multiline">{valueText(data.ownerAddress)}</td>
          </tr>
          <tr className="h-person-4">
            <th colSpan={4} className="bg-major">보험료 납입자</th>
          </tr>
          <tr className="h-person-5">
            <th className="bg-minor">계약자</th>
            <td>{valueText(data.payerName)}</td>
            <th className="bg-minor">휴대폰</th>
            <td>{valueText(data.payerPhone)}</td>
          </tr>
          <tr className="h-person-6">
            <th className="bg-minor">주민번호</th>
            <td>{valueText(data.payerResidentNumber)}</td>
            <th className="bg-minor">주소</th>
            <td className="left multiline">{valueText(data.payerAddress)}</td>
          </tr>
        </tbody>
      </table>

      <table className="insurance-table vehicle-info-table">
        <colgroup>
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '220.2px' }} />
          <col style={{ width: '129.67px' }} />
          <col style={{ width: '245.2px' }} />
        </colgroup>
        <tbody>
          <tr className="h-vehicle">
            <th rowSpan={4} className="bg-major section-cell">차량사항</th>
            <th className="bg-minor">차량번호</th>
            <td>{valueText(data.vehicleNumber)}</td>
            <th className="bg-minor">마일리지</th>
            <td className="right">
              <OptionLine options={YES_NO_OPTIONS} selected={data.mileageYn} />
            </td>
          </tr>
          <tr className="h-vehicle">
            <th className="bg-minor">차명</th>
            <td>{valueText(data.vehicleModel)}</td>
            <th className="bg-minor">블박</th>
            <td className="right">
              <OptionLine options={YES_NO_OPTIONS} selected={data.blackboxYn} />
            </td>
          </tr>
          <tr className="h-vehicle">
            <th className="bg-minor">연식</th>
            <td>{valueText(data.vehicleYear)}</td>
            <th className="bg-minor">계좌번호</th>
            <td>{valueText(data.bankAccount)}</td>
          </tr>
          <tr className="h-vehicle-last">
            <th className="bg-minor">기타부속</th>
            <td className="left multiline" colSpan={3}>
              {valueText(data.extraAccessories)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="insurance-note">* 굵은선 안에 내용은 필히 기재해주셔야 합니다.</p>

      <table className="insurance-table coverage-table">
        <colgroup>
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '68.33px' }} />
          <col style={{ width: '110.07px' }} />
          <col style={{ width: '178.4px' }} />
          <col style={{ width: '306.4px' }} />
        </colgroup>
        <tbody>
          <tr className="h-coverage">
            <th colSpan={5} className="bg-major">담보사항</th>
          </tr>
          <tr className="h-coverage">
            <th colSpan={2} className="bg-minor left indent">대인배상Ⅰ</th>
            <td colSpan={3} className="left">
              가입필수 (사망 / 후유장애 최고 1.5억한도 / 부상 최고 3천 한도)
            </td>
          </tr>
          <tr className="h-coverage">
            <th colSpan={2} className="bg-minor left indent">대인배상Ⅱ</th>
            <td colSpan={3}>무한</td>
          </tr>
          <tr className="h-coverage">
            <th colSpan={2} className="bg-minor left indent">대물배상</th>
            <td colSpan={3}>
              <OptionLine options={PROPERTY_DAMAGE_OPTIONS} selected={data.propertyDamage} />
            </td>
          </tr>
          <tr className="h-coverage">
            <th colSpan={2} className="bg-minor left indent">자손/자상</th>
            <td colSpan={3} className="left">
              <OptionLine options={PERSONAL_INJURY_OPTIONS} selected={data.personalInjury} />
            </td>
          </tr>
          <tr className="h-coverage">
            <th colSpan={2} className="bg-minor left indent">무보험차상해</th>
            <td colSpan={3}>
              <OptionLine
                options={UNINSURED_MOTORIST_OPTIONS}
                selected={data.uninsuredMotorist}
              />
            </td>
          </tr>
          <tr className="h-coverage">
            <th colSpan={2} className="bg-minor left indent">자기차량손해</th>
            <td colSpan={3}>
              <OptionLine
                options={OWN_VEHICLE_DAMAGE_OPTIONS}
                selected={data.ownVehicleDamage}
              />
            </td>
          </tr>
          <tr className="h-coverage">
            <th colSpan={2} className="bg-minor left indent">긴급출동</th>
            <td colSpan={3}>
              <OptionLine
                options={EMERGENCY_ASSIST_OPTIONS}
                selected={data.emergencyAssist}
              />
            </td>
          </tr>
          <tr className="h-coverage">
            <th className="bg-minor left">운전범위</th>
            <td colSpan={4} className="left text-small">
              <OptionLine options={DRIVER_SCOPE_OPTIONS} selected={data.driverScope} />
            </td>
          </tr>
          <tr className="h-coverage">
            <th className="bg-minor left">운전연령</th>
            <td colSpan={4} className="left">
              <OptionLine options={DRIVER_AGE_OPTIONS} selected={data.driverAge} />
            </td>
          </tr>
          <tr className="h-driver">
            <th colSpan={3} className="bg-minor left indent-sm">지정 1인 운전자 이름 & 주민번호</th>
            <td colSpan={2}>
              {valueText(data.designatedDriverName)}
              {data.designatedDriverResidentNumber
                ? ` / ${data.designatedDriverResidentNumber}`
                : ''}
            </td>
          </tr>
          <tr className="h-driver">
            <th colSpan={3} className="bg-minor left indent-xs">배우자 / 최저운전자 이름 & 주민번호</th>
            <td colSpan={2}>
              {valueText(data.spouseOrMinDriverName)}
              {data.spouseOrMinDriverResidentNumber
                ? ` / ${data.spouseOrMinDriverResidentNumber}`
                : ''}
            </td>
          </tr>
          <tr className="h-driver">
            <th colSpan={2} className="bg-minor left indent">경력자지정</th>
            <th colSpan={2} className="left">경력1: {valueText(data.career1)}</th>
            <th className="left">경력2: {valueText(data.career2)}</th>
          </tr>
        </tbody>
      </table>

      <table className="insurance-table memo-table">
        <tbody>
          <tr>
            <th className="left bg-major">MEMO</th>
          </tr>
          <tr className="h-memo">
            <td className="left multiline">{valueText(data.memo)}</td>
          </tr>
        </tbody>
      </table>
    </article>
  )
}
