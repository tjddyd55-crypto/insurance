/**
 * 검증 픽스처: 주류 업종(liquor) 빌더 저장 페이로드와 동일 규격(snake_case).
 * 브라우저 빌더 대량 입력 대신 재현 가능한 회귀·스크립트 푸시에 사용합니다.
 */

const IC = 'liquor'

const opt = (value, label) => ({ value, label })

/** @returns {Record<string, unknown>} */
export function buildLiquorCompanyDynamicCrmTemplateBody() {
  const form_fields = [
    fk('거래처명', 'customer.name', 'core', 'text'),
    fk('담당자명', 'liquor.contactPerson', 'extension', 'text'),
    fk('연락처', 'customer.phone', 'core', 'phone'),
    fk('사업자번호', 'liquor.businessRegNo', 'extension', 'text'),
    fk('주소', 'customer.address', 'core', 'text'),
    {
      ...baseField('liquor.accountType', 'extension', 'select'),
      label: '거래처 유형',
      options: [opt('wholesale', '도매'), opt('retail', '소매'), opt('both', '복합')],
    },
    fk('주요 납품 품목', 'liquor.mainProducts', 'extension', 'text'),
    {
      ...baseField('liquor.licenseOk', 'extension', 'select'),
      label: '주류 면허 여부',
      options: [opt('yes', '유'), opt('no', '무')],
    },
    fk('결제 조건', 'liquor.paymentTerms', 'extension', 'text'),
    fk('미수금', 'liquor.arBalance', 'extension', 'number'),
    fk('담당 영업자', 'liquor.salesOwner', 'extension', 'text'),
    {
      ...baseField('liquor.contractStatus', 'extension', 'select'),
      label: '계약 상태',
      options: [
        opt('draft', '초안'),
        opt('active', '유효'),
        opt('suspended', '일시중지'),
        opt('terminated', '종료'),
      ],
    },
    fk('배송 요일', 'liquor.deliveryWeekday', 'extension', 'text'),
    fk('배송 지역', 'liquor.deliveryArea', 'extension', 'text'),
    {
      ...baseField('liquor.tempClass', 'extension', 'select'),
      label: '냉장/상온 구분',
      options: [
        opt('chilled', '냉장'),
        opt('ambient', '상온'),
        opt('mixed', '혼합'),
      ],
    },
    fk('최근 납품일', 'liquor.lastDeliveryDate', 'extension', 'date'),
    fk('주 납품처', 'liquor.mainOutlet', 'extension', 'text'),
    {
      ...baseField('liquor.priority', 'extension', 'select'),
      label: '우선순위',
      options: [
        opt('high', '높음'),
        opt('medium', '중간'),
        opt('low', '낮음'),
      ],
    },
    fk('최근 상담일', 'liquor.lastConsultDate', 'extension', 'date'),
    fk('상담 메모', 'liquor.consultMemo', 'extension', 'textarea'),
    fk('특이사항', 'liquor.notes', 'extension', 'textarea'),
  ].map((f, idx) => ({ ...f, order: (idx + 1) * 10, domain: IC }))

  const list_columns = [
    lc('거래처명', 'customer_name', 'customer.name'),
    lc('연락처', 'customer_phone', 'customer.phone'),
    lc('거래처 유형', 'liquor_accountType', 'liquor.accountType'),
    lc('주요 납품 품목', 'liquor_mainProducts', 'liquor.mainProducts'),
    lc('결제 조건', 'liquor_paymentTerms', 'liquor.paymentTerms'),
    lc('미수금', 'liquor_arBalance', 'liquor.arBalance'),
    lc('담당 영업자', 'liquor_salesOwner', 'liquor.salesOwner'),
    lc('최근 상담일', 'liquor_lastConsultDate', 'liquor.lastConsultDate'),
    lc('계약 상태', 'liquor_contractStatus', 'liquor.contractStatus'),
  ].map((c, idx) => ({ ...c, order: (idx + 1) * 10, domain: IC }))

  const detail_tabs = [
    dt('liquor_basic', '기본 정보', [
      'customer.name',
      'liquor.contactPerson',
      'customer.phone',
      'liquor.businessRegNo',
      'customer.address',
      'liquor.accountType',
    ]),
    dt('liquor_trade', '거래 정보', [
      'liquor.mainProducts',
      'liquor.licenseOk',
      'liquor.paymentTerms',
      'liquor.arBalance',
      'liquor.salesOwner',
      'liquor.contractStatus',
    ]),
    dt('liquor_delivery', '배송·납품 정보', [
      'liquor.deliveryWeekday',
      'liquor.deliveryArea',
      'liquor.tempClass',
      'liquor.lastDeliveryDate',
      'liquor.mainOutlet',
    ]),
    dt('liquor_admin', '관리 정보', [
      'liquor.priority',
      'liquor.lastConsultDate',
      'liquor.consultMemo',
      'liquor.notes',
    ]),
  ].map((t, idx) => ({
    tabId: t.tabId,
    label: t.label,
    fieldKeys: t.fieldKeys,
    order: (idx + 1) * 10,
    visibleDefault: true,
    domain: IC,
    featureBinding: `dynamic.${t.tabId}`,
  }))

  return {
    name: '주류회사 고객관리 템플릿',
    industry_code: IC,
    description: '',
    status: 'active',
    form_fields,
    list_columns,
    detail_tabs,
    shared_feature_bindings: ['crm-storage-files', 'crm-consultations'],
    extension_feature_bindings: [],
  }
}

/** @returns {Record<string, unknown>} */
function baseField(fieldKey, storage, type) {
  return {
    fieldKey,
    label: '',
    type,
    widget: type,
    required: false,
    placeholder: '',
    visibleDefault: true,
    storage,
    privacyLevel: 'normal',
    options: [],
    domain: IC,
  }
}

function fk(label, fieldKey, storage, type) {
  return { ...baseField(fieldKey, storage, type), label }
}

function lc(label, columnKey, sourceFieldKey) {
  return { columnKey, label, sourceFieldKey, visibleDefault: true, domain: IC }
}

function dt(tabId, label, fieldKeys) {
  return { tabId, label, fieldKeys }
}
