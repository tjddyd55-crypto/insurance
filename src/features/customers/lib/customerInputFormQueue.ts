export const INITIAL_CUSTOMER_FORM_LOCAL_ID = 'customer-form-1'

export type CustomerInputFormItem<T> = {
  localId: string
  values: T
}

/** 다음 추가 폼에 쓸 localId 시퀀스. 초기 폼이 customer-form-1 이므로 1부터 시작한다. */
export const INITIAL_CUSTOMER_FORM_ID_SEQ = 1

export function createCustomerFormLocalId(seq: number): string {
  return `customer-form-${seq}`
}

/**
 * 첫 번째 고객(index 0)은 삭제할 수 없다. localId 기준으로 제거한다.
 */
export function removeCustomerInputFormItem<T>(
  forms: CustomerInputFormItem<T>[],
  localId: string,
): CustomerInputFormItem<T>[] {
  if (forms.length <= 1) {
    return forms
  }
  const removeIndex = forms.findIndex((row) => row.localId === localId)
  if (removeIndex <= 0) {
    return forms
  }
  return forms.filter((row) => row.localId !== localId)
}
