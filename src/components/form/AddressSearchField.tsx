import { useCallback, useEffect, useRef, useState } from 'react'

import { BaseDialog } from '../dialog/BaseDialog'
import FormButton from './FormButton'
import FormInput from './FormInput'
import type { AddressSearchValue } from './addressSearchUtils'
import {
  loadKakaoPostcode,
  type DaumPostcodeData,
  type DaumPostcodeInstance,
} from '../../lib/kakaoPostcode/loadKakaoPostcode'

export type { AddressSearchValue } from './addressSearchUtils'

/**
 * 카카오(다음) 우편번호 검색 기반 주소 입력 필드.
 *
 * 책임:
 *   - 우편번호 + 기본주소(도로명/지번) 는 검색 결과로만 채워질 수 있게 하여
 *     사용자 오타를 원천 차단한다(readonly 입력).
 *   - 상세주소는 자유 입력이며, 검색 완료 직후 자동으로 포커스를 옮겨 입력 흐름을 끊지 않는다.
 *   - 화면 순서: 주소 검색 → 우편번호 → 기본주소 → 상세주소.
 *   - 검색 UI 는 모달 안에 카카오 위젯을 embed 해, 팝업 차단이나 별도 창 UX 혼란을 피한다.
 *
 * 상위가 이 필드를 "제어(controlled)" 한다. 값 객체는 3-튜플:
 *   { zonecode, baseAddress, detailAddress }
 * 최종 저장 시에는 `formatAddressForSave` 로 합쳐 단일 문자열로 직렬화한다.
 *   (현재 고객 테이블의 address 는 단일 컬럼이라 단일 문자열로 보내야 한다.)
 *
 * 지도 표시는 의도적으로 포함하지 않는다 — 주소 자동완성만 필요하다는 요구에 정합.
 */

export interface AddressSearchFieldProps {
  value: AddressSearchValue
  onChange: (next: AddressSearchValue) => void
  /** 폼 레이아웃 안에 들어갈 때 컨테이너 클래스. */
  className?: string
  /** 기본주소 input 의 placeholder. */
  addressPlaceholder?: string
  /** 상세주소 input 의 placeholder. */
  detailPlaceholder?: string
  /** 검색 버튼 라벨. */
  searchButtonLabel?: string
  /** 우편번호 input 의 placeholder. */
  zonecodePlaceholder?: string
  /** 비활성 여부(예: 저장 진행 중). */
  disabled?: boolean
}

const EMPTY_VALUE: AddressSearchValue = {
  zonecode: '',
  baseAddress: '',
  detailAddress: '',
}

/** 결과에서 표준 "기본주소" 문자열을 만든다. 건물명(아파트) 이 있으면 " (xxx)" 로 붙인다. */
function buildBaseAddress(data: DaumPostcodeData): string {
  const primary = data.addressType === 'R' ? data.roadAddress || data.jibunAddress : data.jibunAddress || data.roadAddress
  const building = data.buildingName?.trim()
  /*
   * buildingName 은 도로명 주소 선택 시 "래미안", "e편한세상 101동" 처럼 입주자에게 중요한 정보.
   * 도로명 주소를 우선 택했더라도 건물명이 있으면 붙여 주는 편이 일반 사용자에게 친숙하다.
   * 지번 주소만 있을 때는 building 이 공란일 확률이 높아 자연히 생략된다.
   */
  if (data.addressType === 'R' && building) {
    return `${primary} (${building})`
  }
  return primary
}

export default function AddressSearchField({
  value,
  onChange,
  className,
  addressPlaceholder = '주소 검색 버튼을 눌러 주세요',
  detailPlaceholder = '상세주소 (동/호수 등)',
  searchButtonLabel = '주소 검색',
  zonecodePlaceholder = '우편번호',
  disabled,
}: AddressSearchFieldProps) {
  const [open, setOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const embedRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<DaumPostcodeInstance | null>(null)
  const detailInputRef = useRef<HTMLInputElement | null>(null)

  /**
   * 모달을 여는 유일한 엔트리포인트. 이전 로드 실패 상태를 여기서 초기화하고 open 을 true 로 만든다.
   * useEffect 안에서 동기적으로 setState 하지 않도록 "열림 직전" 에 상태를 정돈한다.
   */
  const openDialog = useCallback(() => {
    if (disabled) return
    setLoadError(null)
    setOpen(true)
  }, [disabled])

  const patch = useCallback(
    (next: Partial<AddressSearchValue>) => {
      onChange({ ...(value ?? EMPTY_VALUE), ...next })
    },
    [onChange, value],
  )

  const handleSelect = useCallback(
    (data: DaumPostcodeData) => {
      patch({
        zonecode: data.zonecode ?? '',
        baseAddress: buildBaseAddress(data),
        /*
         * 기본주소가 바뀌면 이전 상세주소는 대부분 의미가 없다(다른 건물로 이동).
         * 그러나 재검색 중 같은 건물 내 호수만 바꾸려는 경우를 배려해, 명시적 삭제는 하지 않는다.
         * 상세주소는 사용자가 스스로 지우거나 덮어쓰도록 둔다.
         */
        detailAddress: value?.detailAddress ?? '',
      })
      setOpen(false)
      /* 모달이 닫힌 뒤(다음 프레임) 상세주소에 포커스 — 입력 흐름을 끊지 않는 배려. */
      window.setTimeout(() => {
        detailInputRef.current?.focus()
      }, 0)
    },
    [patch, value?.detailAddress],
  )

  /* 모달이 열려 있는 동안에만 위젯을 embed 한다. 닫히면 embed 엘리먼트가 unmount 되므로 안전. */
  useEffect(() => {
    if (!open) {
      instanceRef.current = null
      return
    }
    let cancelled = false
    loadKakaoPostcode()
      .then((Postcode) => {
        if (cancelled || !embedRef.current) return
        /* 동일 모달이 재열릴 때 이전 embed 노드를 비워 주지 않으면 위젯이 중첩된다. */
        embedRef.current.innerHTML = ''
        const instance = new Postcode({
          oncomplete: handleSelect,
          width: '100%',
          height: '100%',
        })
        instance.embed(embedRef.current)
        instanceRef.current = instance
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : '주소 검색 모듈을 불러오지 못했습니다.'
        setLoadError(message)
      })
    return () => {
      cancelled = true
    }
  }, [open, handleSelect])

  const current = value ?? EMPTY_VALUE
  const rootClass = ['customer-address-field', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <div className="customer-address-field__search-row">
        <FormButton
          htmlType="button"
          variant="secondary"
          size="sm"
          fullWidth
          disabled={disabled}
          onClick={openDialog}
        >
          {searchButtonLabel}
        </FormButton>
      </div>

      <FormInput
        className="field__control address-search-field__zonecode"
        placeholder={zonecodePlaceholder}
        value={current.zonecode}
        readOnly
        aria-label="우편번호"
        onClick={openDialog}
      />

      <FormInput
        className="field__control address-search-field__base"
        placeholder={addressPlaceholder}
        value={current.baseAddress}
        readOnly
        aria-label="기본 주소"
        onClick={openDialog}
      />

      <FormInput
        ref={detailInputRef}
        className="field__control address-search-field__detail"
        placeholder={detailPlaceholder}
        value={current.detailAddress}
        disabled={disabled}
        aria-label="상세 주소"
        onChange={(event) => patch({ detailAddress: event.target.value })}
      />

      <BaseDialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="주소 검색"
        panelClassName="address-search-field__dialog"
        usePortal
      >
        <div className="address-search-field__dialog-head">
          <span>주소 검색</span>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            onClick={() => setOpen(false)}
            aria-label="닫기"
          >
            닫기
          </FormButton>
        </div>
        {loadError ? (
          <p className="address-search-field__error">
            {loadError}
            <br />
            네트워크 상태를 확인하고 다시 시도해 주세요.
          </p>
        ) : null}
        <div
          ref={embedRef}
          className="address-search-field__embed"
          role="region"
          aria-label="카카오 우편번호 검색 위젯"
        />
      </BaseDialog>
    </div>
  )
}
