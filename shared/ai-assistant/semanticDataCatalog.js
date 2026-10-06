import { AI_SEMANTIC_BUSINESS_FIELDS_RAW } from './semanticBusinessDomains.js'

/**
 * ONE FC AI semantic data catalog SSOT.
 *
 * IMPORTANT:
 * - This file defines business meaning <-> canonical field <-> DB storage.
 * - It intentionally DOES NOT contain natural-language synonym/keyword lists.
 *   GPT interprets free-form language and selects semantic/query keys.
 * - Query, input and update layers must consume this definition instead of
 *   maintaining independent meanings for the same DB field.
 */

const C = Object.freeze

export const AI_SEMANTIC_DATA_CLASS = C({
  USER_BUSINESS: 'USER_BUSINESS',
  INTERNAL_SYSTEM: 'INTERNAL_SYSTEM',
  SECRET_SECURITY: 'SECRET_SECURITY',
})

export const AI_SEMANTIC_DOMAIN = C({
  CUSTOMER: 'CUSTOMER',
  USER_WORKSPACE: 'USER_WORKSPACE',
  SYSTEM: 'SYSTEM',
})

export const AI_CUSTOMER_RELATED_TABLES = C([
  'customers',
  'customer_cars',
  'customer_fire_insurance_locations',
  'customer_special_dates',
  'customer_custom_fields',
  'customer_consultations',
  'customer_claim_requests',
  'customer_claim_request_files',
  'customer_app_profiles',
  'customer_files',
  'ta_call_assignments',
  'customer_relations',
  'customer_premium_payment_methods',
  'customer_payment_cards',
  'customer_card_payment_contracts',
  'customer_card_payment_completions',
])

function inferDataClass(def) {
  if (def.privacyLevel === 'secret') return AI_SEMANTIC_DATA_CLASS.SECRET_SECURITY
  if (def.systemManaged || def.privacyLevel === 'internal') return AI_SEMANTIC_DATA_CLASS.INTERNAL_SYSTEM
  return AI_SEMANTIC_DATA_CLASS.USER_BUSINESS
}

function inferDomain(def) {
  if (AI_CUSTOMER_RELATED_TABLES.includes(def.storage?.table)) return AI_SEMANTIC_DOMAIN.CUSTOMER
  if (def.storage?.table === 'todos' || def.storage?.table === 'calendar_items' || def.storage?.table === 'memo' || def.storage?.table === 'user_insurer_accounts') {
    return AI_SEMANTIC_DOMAIN.USER_WORKSPACE
  }
  return AI_SEMANTIC_DOMAIN.SYSTEM
}

function field(def) {
  const dataClass = def.dataClass ?? inferDataClass(def)
  const semanticDomain = def.semanticDomain ?? inferDomain(def)
  return C({
    privacyLevel: 'normal',
    dataClass,
    semanticDomain,
    genericReadAllowed:
      dataClass === AI_SEMANTIC_DATA_CLASS.USER_BUSINESS &&
      semanticDomain === AI_SEMANTIC_DOMAIN.CUSTOMER &&
      def.capabilities?.read !== false,
    canonicalValues: null,
    emptyValue: null,
    systemManaged: false,
    capabilities: C({ read: true, filter: false, input: false, update: false }),
    query: null,
    ...def,
    storage: C(def.storage),
    capabilities: C({
      read: true,
      filter: false,
      input: false,
      update: false,
      ...(def.capabilities ?? {}),
    }),
    canonicalValues: def.canonicalValues ? C([...def.canonicalValues]) : null,
    query: def.query ? C({ ...def.query, operators: C([...(def.query.operators ?? [])]) }) : null,
  })
}

export const AI_SEMANTIC_CATALOG_VERSION = '1.1.0'

export const AI_SEMANTIC_MANAGED_TABLES = C([
  'customers',
  'customer_cars',
  'customer_fire_insurance_locations',
  'customer_special_dates',
  'customer_custom_fields',
  'customer_consultations',
  'todos',
  'calendar_items',
  'customer_claim_requests',
  'customer_claim_request_files',
  'customer_app_profiles',
  'customer_files',
  'memo',
  'user_insurer_accounts',
  'ta_call_assignments',
  'customer_relations',
  'customer_premium_payment_methods',
  'customer_payment_cards',
  'customer_card_payment_contracts',
  'customer_card_payment_completions',
])

export const AI_SEMANTIC_FIELDS = C([
  // customers — identifiers / ownership / lifecycle
  field({ key:'customer.id', label:'고객 내부 ID', description:'CRM 고객 레코드의 내부 식별자.', valueType:'integer', storage:{table:'customers',column:'id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customer.ownerUserId', label:'고객 소유 사용자', description:'고객 레코드를 소유하는 ONE FC 사용자 ID.', valueType:'string', storage:{table:'customers',column:'user_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customer.gaId', label:'GA 소속', description:'고객이 속한 GA 조직 ID.', valueType:'integer', storage:{table:'customers',column:'ga_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customer.tenantId', label:'테넌트', description:'멀티테넌트 격리를 위한 내부 테넌트 ID.', valueType:'integer', storage:{table:'customers',column:'tenant_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customer.ownerScopeUserId', label:'가시성 소유자', description:'고객 가시성 정책의 소유 사용자 ID.', valueType:'string', storage:{table:'customers',column:'owner_user_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customer.createdByUserId', label:'등록 사용자', description:'고객을 최초 등록한 사용자 ID.', valueType:'string', storage:{table:'customers',column:'created_by_user_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customer.visibilityScope', label:'고객 공개 범위', description:'고객 레코드 접근 범위 정책 값.', valueType:'string', storage:{table:'customers',column:'visibility_scope'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customer.createdAt', label:'등록일', description:'고객 레코드가 생성된 시각.', valueType:'datetime', storage:{table:'customers',column:'created_at'}, systemManaged:true, query:{key:'createdAt',type:'date',operators:['BEFORE','AFTER','BETWEEN','PERIOD']} , capabilities:{filter:true} }),
  field({ key:'customer.deletedAt', label:'삭제 시각', description:'고객 소프트 삭제 시각. 값이 있으면 삭제된 고객이다.', valueType:'datetime', storage:{table:'customers',column:'deleted_at'}, systemManaged:true, privacyLevel:'internal' }),

  // customers — user/business data
  field({ key:'customer.name', label:'이름', description:'고객의 이름 또는 표시명.', valueType:'string', storage:{table:'customers',column:'name'}, capabilities:{filter:true,input:true,update:true}, query:{key:'name',type:'string',operators:['EQ','CONTAINS','STARTS_WITH']} }),
  field({ key:'customer.customerCode', label:'고객번호', description:'CRM에서 고객을 식별하기 위한 고객 코드.', valueType:'string', storage:{table:'customers',column:'customer_code'}, capabilities:{filter:true}, query:{key:'customerCode',type:'string',operators:['EQ','CONTAINS','STARTS_WITH']} }),
  field({ key:'customer.ssn', label:'주민등록번호', description:'고객 주민등록번호 또는 허용된 식별번호.', valueType:'string', storage:{table:'customers',column:'ssn'}, privacyLevel:'identifying', capabilities:{filter:true,input:true,update:true}, query:{key:'ssn',type:'string',operators:['EQ','CONTAINS','ENDS_WITH']} }),
  field({ key:'customer.birthDate', label:'생년월일', description:'고객의 생년월일.', valueType:'date', storage:{table:'customers',column:'birth_date'}, privacyLevel:'sensitive', capabilities:{filter:true,input:true,update:true}, query:{key:'birthDate',type:'date',operators:['EQ','BEFORE','AFTER','BETWEEN','PERIOD']} }),
  field({ key:'customer.gender', label:'성별', description:'고객 성별. DB canonical 값은 male/female이며 미지정은 빈값이다.', valueType:'enum', storage:{table:'customers',column:'gender'}, canonicalValues:['male','female'], emptyValue:'', capabilities:{filter:true,input:true,update:true}, query:{key:'gender',type:'enum',operators:['EQ','IN'],enumValues:['MALE','FEMALE']} }),
  field({ key:'customer.phone', label:'연락처', description:'고객 대표 휴대전화 또는 연락처.', valueType:'string', storage:{table:'customers',column:'phone'}, capabilities:{filter:true,input:true,update:true}, query:{key:'phone',type:'string',operators:['EQ','CONTAINS','ENDS_WITH']} }),
  field({ key:'customer.carrier', label:'통신사', description:'고객 휴대전화 통신사.', valueType:'string', storage:{table:'customers',column:'carrier'}, capabilities:{filter:true,input:true,update:true}, query:{key:'carrier',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.address', label:'주소', description:'고객의 기본 주소.', valueType:'string', storage:{table:'customers',column:'address'}, capabilities:{filter:true,input:true,update:true}, query:{key:'address',type:'string',operators:['CONTAINS','EQ']} }),
  field({ key:'customer.addressSido', label:'주소 시도', description:'주소에서 분리 저장한 시/도.', valueType:'string', storage:{table:'customers',column:'address_sido'}, capabilities:{read:true,input:true,update:true} }),
  field({ key:'customer.addressSigungu', label:'주소 시군구', description:'주소에서 분리 저장한 시/군/구.', valueType:'string', storage:{table:'customers',column:'address_sigungu'}, capabilities:{read:true,input:true,update:true} }),
  field({ key:'customer.addressEupmyeondong', label:'주소 읍면동', description:'주소에서 분리 저장한 읍/면/동.', valueType:'string', storage:{table:'customers',column:'address_eupmyeondong'}, capabilities:{read:true,input:true,update:true} }),
  field({ key:'customer.height', label:'키', description:'고객 신장 정보.', valueType:'string', storage:{table:'customers',column:'height'}, privacyLevel:'sensitive', capabilities:{filter:true,input:true,update:true}, query:{key:'height',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.weight', label:'몸무게', description:'고객 체중 정보.', valueType:'string', storage:{table:'customers',column:'weight'}, privacyLevel:'sensitive', capabilities:{filter:true,input:true,update:true}, query:{key:'weight',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.job', label:'직업·회사', description:'고객 직업 또는 근무처 자유 입력 값.', valueType:'string', storage:{table:'customers',column:'job'}, capabilities:{filter:true,input:true,update:true}, query:{key:'job',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.drivingText', label:'운전 상태 텍스트', description:'레거시 운전 상태 자유 입력 값.', valueType:'string', storage:{table:'customers',column:'driving'}, capabilities:{filter:true,input:true,update:true}, query:{key:'drivingText',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.isDriver', label:'운전 여부', description:'고객의 운전자 여부.', valueType:'boolean', storage:{table:'customers',column:'is_driver'}, capabilities:{filter:true,input:true,update:true}, query:{key:'isDriver',type:'boolean',operators:['EQ']} }),
  field({ key:'customer.medical', label:'의료·건강 고지', description:'보험 상담에 사용하는 의료·건강 고지 요약 정보.', valueType:'string', storage:{table:'customers',column:'medical'}, privacyLevel:'sensitive', capabilities:{filter:true,input:true,update:true}, query:{key:'medical',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.insuranceAge', label:'보험나이', description:'보험 기준으로 계산·저장한 고객 나이.', valueType:'integer', storage:{table:'customers',column:'insurance_age'}, capabilities:{filter:true}, query:{key:'insuranceAge',type:'derived',operators:['EQ','BETWEEN'],derived:'insuranceAgeFromBirth'} }),
  field({ key:'customer.nextAgeDate', label:'상령일', description:'다음 보험 상령일.', valueType:'date', storage:{table:'customers',column:'next_age_date'}, capabilities:{filter:true}, query:{key:'nextAgeDate',type:'date',operators:['EQ','BEFORE','AFTER','BETWEEN','PERIOD']} }),
  field({ key:'customer.notes', label:'고객 메모·확장 노트', description:'메모, 보험가입내역, 계좌번호, 치료/약복용 메모 등을 보관하는 JSON 영역.', valueType:'json', storage:{table:'customers',column:'notes'}, privacyLevel:'sensitive', capabilities:{filter:true,input:true,update:true}, query:{key:'memo',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.isFavorite', label:'중요 고객', description:'즐겨찾기 또는 중요 고객 표시 여부.', valueType:'boolean', storage:{table:'customers',column:'is_favorite'}, capabilities:{filter:true,input:true,update:true}, query:{key:'isFavorite',type:'boolean',operators:['EQ']} }),
  field({ key:'customer.smsOptOut', label:'문자 수신거부', description:'CRM 문자 수신 거부 여부.', valueType:'boolean', storage:{table:'customers',column:'sms_opt_out'}, capabilities:{filter:true,input:true,update:true}, query:{key:'smsOptOut',type:'boolean',operators:['EQ']} }),
  field({ key:'customer.crmExtension', label:'CRM 확장 필드', description:'업종/템플릿별 확장 고객 필드 JSON.', valueType:'json', storage:{table:'customers',column:'crm_extension'}, capabilities:{read:true,input:true,update:true} }),
  field({ key:'customer.inflowSource', label:'유입 경로', description:'고객 유입 또는 확보 경로.', valueType:'string', storage:{table:'customers',column:'inflow_source'}, capabilities:{filter:true,input:true,update:true}, query:{key:'inflowSource',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.inflowSourceNote', label:'유입 경로 메모', description:'유입 경로에 대한 추가 설명.', valueType:'string', storage:{table:'customers',column:'inflow_source_note'}, capabilities:{input:true,update:true} }),
  field({ key:'customer.referrerName', label:'소개자·이관 출처', description:'고객을 소개했거나 이관한 사람/출처.', valueType:'string', storage:{table:'customers',column:'referrer_name'}, capabilities:{filter:true,input:true,update:true}, query:{key:'referrerName',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.businessRepresentativeName', label:'사업자 대표자명', description:'고객 사업체의 대표자명.', valueType:'string', storage:{table:'customers',column:'business_representative_name'}, capabilities:{filter:true,input:true,update:true}, query:{key:'businessRepresentativeName',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.businessNumber', label:'사업자등록번호', description:'고객 사업체의 사업자등록번호.', valueType:'string', storage:{table:'customers',column:'business_number'}, capabilities:{filter:true,input:true,update:true}, query:{key:'businessNumber',type:'string',operators:['EQ','CONTAINS','ENDS_WITH']} }),
  field({ key:'customer.businessAddress', label:'사업장 주소', description:'고객 사업체 소재지 주소.', valueType:'string', storage:{table:'customers',column:'business_address'}, capabilities:{filter:true,input:true,update:true}, query:{key:'businessAddress',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.businessMemo', label:'사업자 메모', description:'고객 사업자 정보에 대한 자유 메모.', valueType:'string', storage:{table:'customers',column:'business_memo'}, capabilities:{filter:true,input:true,update:true}, query:{key:'businessMemo',type:'string',operators:['EQ','CONTAINS']} }),

  // customers — legacy primary vehicle mirror
  field({ key:'customer.primaryCarType', label:'대표 차종', description:'대표 차량의 레거시 미러 차종.', valueType:'string', storage:{table:'customers',column:'car_type'}, capabilities:{filter:true,input:true,update:true}, query:{key:'carType',type:'string',operators:['EQ','CONTAINS','IS_NULL','IS_NOT_NULL']} }),
  field({ key:'customer.primaryCarNumber', label:'대표 차량번호', description:'대표 차량의 레거시 미러 차량번호.', valueType:'string', storage:{table:'customers',column:'car_number'}, capabilities:{filter:true,input:true,update:true}, query:{key:'carNumber',type:'string',operators:['EQ','CONTAINS','IS_NULL','IS_NOT_NULL']} }),
  field({ key:'customer.primaryCarModel', label:'대표 차량모델', description:'대표 차량의 레거시 미러 모델명.', valueType:'string', storage:{table:'customers',column:'car_model'}, capabilities:{filter:true,input:true,update:true}, query:{key:'carModel',type:'string',operators:['EQ','CONTAINS','IS_NULL','IS_NOT_NULL']} }),
  field({ key:'customer.primaryCarYear', label:'대표 차량 연식', description:'대표 차량의 레거시 미러 연식.', valueType:'string', storage:{table:'customers',column:'car_year'}, capabilities:{filter:true,input:true,update:true}, query:{key:'carYear',type:'string',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.primaryCarRenewalDate', label:'대표 차량 만기일', description:'대표 차량의 레거시 미러 자동차보험 만기·갱신일.', valueType:'date', storage:{table:'customers',column:'renewal_date'}, capabilities:{filter:true,input:true,update:true}, query:{key:'renewalDate',type:'date',operators:['EQ','BEFORE','AFTER','BETWEEN','PERIOD']} }),

  // customer_cars
  field({ key:'vehicle.id', label:'차량 내부 ID', description:'고객 차량 레코드 내부 ID.', valueType:'integer', storage:{table:'customer_cars',column:'id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'vehicle.customerId', label:'차량 고객 ID', description:'차량이 연결된 고객 ID.', valueType:'integer', storage:{table:'customer_cars',column:'customer_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'vehicle.userId', label:'차량 소유 사용자', description:'차량 데이터 소유 사용자 ID.', valueType:'string', storage:{table:'customer_cars',column:'user_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'vehicle.gaId', label:'차량 GA', description:'차량 데이터의 GA 조직 ID.', valueType:'integer', storage:{table:'customer_cars',column:'ga_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'vehicle.carType', label:'차종', description:'고객 차량 종류.', valueType:'string', storage:{table:'customer_cars',column:'car_type'}, capabilities:{input:true,update:true} }),
  field({ key:'vehicle.carNumber', label:'차량번호', description:'차량 번호판 번호.', valueType:'string', storage:{table:'customer_cars',column:'car_number'}, capabilities:{input:true,update:true} }),
  field({ key:'vehicle.carModel', label:'차량 모델', description:'차량 모델명.', valueType:'string', storage:{table:'customer_cars',column:'car_model'}, capabilities:{input:true,update:true} }),
  field({ key:'vehicle.carYear', label:'차량 연식', description:'차량 연식.', valueType:'string', storage:{table:'customer_cars',column:'car_year'}, capabilities:{input:true,update:true} }),
  field({ key:'vehicle.renewalDate', label:'자동차 만기일', description:'해당 차량 자동차보험 만기·갱신 예정일.', valueType:'date', storage:{table:'customer_cars',column:'renewal_date'}, capabilities:{input:true,update:true} }),
  field({ key:'vehicle.memo', label:'자동차 메모', description:'해당 차량에 대한 자유 메모.', valueType:'string', storage:{table:'customer_cars',column:'memo'}, capabilities:{filter:true,input:true,update:true}, query:{key:'carMemo',type:'relation',operators:['EQ','CONTAINS']} }),
  field({ key:'vehicle.isPrimary', label:'대표 차량 여부', description:'고객의 대표 차량 여부.', valueType:'boolean', storage:{table:'customer_cars',column:'is_primary'}, capabilities:{input:true,update:true} }),
  field({ key:'vehicle.sortOrder', label:'차량 정렬 순서', description:'고객 화면에서 차량 표시 순서.', valueType:'integer', storage:{table:'customer_cars',column:'sort_order'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'vehicle.createdAt', label:'차량 등록일', description:'차량 레코드 생성 시각.', valueType:'datetime', storage:{table:'customer_cars',column:'created_at'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'vehicle.updatedAt', label:'차량 수정일', description:'차량 레코드 마지막 수정 시각.', valueType:'datetime', storage:{table:'customer_cars',column:'updated_at'}, systemManaged:true, privacyLevel:'internal' }),

  // fire insurance locations
  field({ key:'fireLocation.id', label:'화재보험 소재지 내부 ID', description:'화재보험 소재지 레코드 내부 ID.', valueType:'integer', storage:{table:'customer_fire_insurance_locations',column:'id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'fireLocation.customerId', label:'화재보험 소재지 고객 ID', description:'소재지가 연결된 고객 ID.', valueType:'integer', storage:{table:'customer_fire_insurance_locations',column:'customer_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'fireLocation.userId', label:'화재보험 소재지 소유 사용자', description:'소재지 데이터 소유 사용자 ID.', valueType:'string', storage:{table:'customer_fire_insurance_locations',column:'user_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'fireLocation.gaId', label:'화재보험 소재지 GA', description:'소재지 데이터의 GA 조직 ID.', valueType:'integer', storage:{table:'customer_fire_insurance_locations',column:'ga_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'fireLocation.address', label:'화재보험 소재지', description:'화재보험 목적물의 주소.', valueType:'string', storage:{table:'customer_fire_insurance_locations',column:'address'}, capabilities:{filter:true,input:true,update:true}, query:{key:'fireLocationAddress',type:'relation',operators:['EQ','CONTAINS','IS_NULL','IS_NOT_NULL']} }),
  field({ key:'fireLocation.memo', label:'화재보험 소재지 메모', description:'화재보험 소재지에 대한 메모.', valueType:'string', storage:{table:'customer_fire_insurance_locations',column:'memo'}, capabilities:{filter:true,input:true,update:true}, query:{key:'fireLocationMemo',type:'relation',operators:['EQ','CONTAINS']} }),
  field({ key:'fireLocation.sortOrder', label:'화재보험 소재지 정렬 순서', description:'소재지 표시 순서.', valueType:'integer', storage:{table:'customer_fire_insurance_locations',column:'sort_order'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'fireLocation.deletedAt', label:'화재보험 소재지 삭제 시각', description:'소재지 소프트 삭제 시각.', valueType:'datetime', storage:{table:'customer_fire_insurance_locations',column:'deleted_at'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'fireLocation.createdAt', label:'화재보험 소재지 등록일', description:'소재지 생성 시각.', valueType:'datetime', storage:{table:'customer_fire_insurance_locations',column:'created_at'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'fireLocation.updatedAt', label:'화재보험 소재지 수정일', description:'소재지 마지막 수정 시각.', valueType:'datetime', storage:{table:'customer_fire_insurance_locations',column:'updated_at'}, systemManaged:true, privacyLevel:'internal' }),

  // special dates
  field({ key:'specialDate.id', label:'특별일 내부 ID', description:'고객 특별일 레코드 내부 ID.', valueType:'integer', storage:{table:'customer_special_dates',column:'id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'specialDate.customerId', label:'특별일 고객 ID', description:'특별일이 연결된 고객 ID.', valueType:'integer', storage:{table:'customer_special_dates',column:'customer_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'specialDate.userId', label:'특별일 소유 사용자', description:'특별일 데이터 소유 사용자 ID.', valueType:'string', storage:{table:'customer_special_dates',column:'user_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'specialDate.gaId', label:'특별일 GA', description:'특별일 데이터 GA 조직 ID.', valueType:'integer', storage:{table:'customer_special_dates',column:'ga_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'specialDate.purposeType', label:'특별일 목적', description:'기념/감사/안내/점검 등 특별일 목적 분류.', valueType:'enum', storage:{table:'customer_special_dates',column:'purpose_type'}, canonicalValues:['CELEBRATION','THANKS','NOTICE','CHECKUP'], capabilities:{input:true,update:true} }),
  field({ key:'specialDate.title', label:'특별일 제목', description:'특별일 표시 제목.', valueType:'string', storage:{table:'customer_special_dates',column:'title'}, capabilities:{input:true,update:true} }),
  field({ key:'specialDate.date', label:'특별일 날짜', description:'고객 특별일 날짜.', valueType:'date', storage:{table:'customer_special_dates',column:'date_value'}, capabilities:{input:true,update:true} }),
  field({ key:'specialDate.memo', label:'특별일 메모', description:'특별일에 대한 추가 메모.', valueType:'string', storage:{table:'customer_special_dates',column:'memo'}, capabilities:{input:true,update:true} }),
  field({ key:'specialDate.sortOrder', label:'특별일 정렬 순서', description:'특별일 표시 순서.', valueType:'integer', storage:{table:'customer_special_dates',column:'sort_order'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'specialDate.deletedAt', label:'특별일 삭제 시각', description:'특별일 소프트 삭제 시각.', valueType:'datetime', storage:{table:'customer_special_dates',column:'deleted_at'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'specialDate.createdAt', label:'특별일 등록일', description:'특별일 생성 시각.', valueType:'datetime', storage:{table:'customer_special_dates',column:'created_at'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'specialDate.updatedAt', label:'특별일 수정일', description:'특별일 마지막 수정 시각.', valueType:'datetime', storage:{table:'customer_special_dates',column:'updated_at'}, systemManaged:true, privacyLevel:'internal' }),

  // arbitrary customer custom fields — meaning is defined by the stored label at runtime
  field({ key:'customField.id', label:'사용자 정의 필드 내부 ID', description:'사용자 정의 고객 필드 레코드 ID.', valueType:'integer', storage:{table:'customer_custom_fields',column:'id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customField.customerId', label:'사용자 정의 필드 고객 ID', description:'사용자 정의 필드가 연결된 고객 ID.', valueType:'integer', storage:{table:'customer_custom_fields',column:'customer_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customField.userId', label:'사용자 정의 필드 소유 사용자', description:'사용자 정의 필드 소유 사용자 ID.', valueType:'string', storage:{table:'customer_custom_fields',column:'user_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customField.gaId', label:'사용자 정의 필드 GA', description:'사용자 정의 필드 GA 조직 ID.', valueType:'integer', storage:{table:'customer_custom_fields',column:'ga_id'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customField.label', label:'사용자 정의 필드명', description:'사용자가 지정한 동적 고객 필드의 의미/이름.', valueType:'string', storage:{table:'customer_custom_fields',column:'label'}, capabilities:{input:true,update:true} }),
  field({ key:'customField.value', label:'사용자 정의 필드 값', description:'사용자 정의 고객 필드에 저장된 값.', valueType:'string', storage:{table:'customer_custom_fields',column:'value'}, capabilities:{input:true,update:true} }),
  field({ key:'customField.sortOrder', label:'사용자 정의 필드 정렬 순서', description:'사용자 정의 필드 표시 순서.', valueType:'integer', storage:{table:'customer_custom_fields',column:'sort_order'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customField.deletedAt', label:'사용자 정의 필드 삭제 시각', description:'사용자 정의 필드 소프트 삭제 시각.', valueType:'datetime', storage:{table:'customer_custom_fields',column:'deleted_at'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customField.createdAt', label:'사용자 정의 필드 등록일', description:'사용자 정의 필드 생성 시각.', valueType:'datetime', storage:{table:'customer_custom_fields',column:'created_at'}, systemManaged:true, privacyLevel:'internal' }),
  field({ key:'customField.updatedAt', label:'사용자 정의 필드 수정일', description:'사용자 정의 필드 마지막 수정 시각.', valueType:'datetime', storage:{table:'customer_custom_fields',column:'updated_at'}, systemManaged:true, privacyLevel:'internal' }),

  // virtual/relation semantics used by current query layer
  field({ key:'customer.company', label:'회사', description:'고객 사용자 정의 필드 중 회사명 의미의 값.', valueType:'relation', storage:{table:'customer_custom_fields',column:'value'}, capabilities:{filter:true}, query:{key:'company',type:'relation',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.primaryInsurer', label:'주력보험사', description:'고객 사용자 정의 필드 중 주력보험사 의미의 값.', valueType:'relation', storage:{table:'customer_custom_fields',column:'value'}, capabilities:{filter:true}, query:{key:'insurer',type:'relation',operators:['EQ','CONTAINS']} }),
  field({ key:'customer.labels', label:'고객 라벨', description:'고객에게 부여된 동적 라벨/태그.', valueType:'relation', storage:{table:'customer_custom_fields',column:'label'}, capabilities:{filter:true}, query:{key:'labels',type:'relation',operators:['INCLUDES','EXCLUDES']} }),
  ...AI_SEMANTIC_BUSINESS_FIELDS_RAW.map(field),
])

const BY_KEY = new Map(AI_SEMANTIC_FIELDS.map((f) => [f.key, f]))
const BY_QUERY_KEY = new Map(AI_SEMANTIC_FIELDS.filter((f) => f.query?.key).map((f) => [f.query.key, f]))

export function getAiSemanticField(key) {
  return BY_KEY.get(String(key ?? '').trim()) ?? null
}

export function getAiSemanticFieldByQueryKey(queryKey) {
  return BY_QUERY_KEY.get(String(queryKey ?? '').trim()) ?? null
}

export function listAiSemanticFields() {
  return [...AI_SEMANTIC_FIELDS]
}

export function listAiQueryableSemanticFields() {
  return AI_SEMANTIC_FIELDS.filter((f) => f.capabilities.filter && f.query?.key)
}

export function listAiInputSemanticFields() {
  return AI_SEMANTIC_FIELDS.filter((f) => f.capabilities.input)
}

export function listAiGenericCustomerReadFields() {
  return AI_SEMANTIC_FIELDS.filter((f) => f.genericReadAllowed)
}

export function listAiSemanticFieldsByDataClass(dataClass) {
  return AI_SEMANTIC_FIELDS.filter((f) => f.dataClass === dataClass)
}

export function listAiSemanticFieldsByDomain(semanticDomain) {
  return AI_SEMANTIC_FIELDS.filter((f) => f.semanticDomain === semanticDomain)
}

export function listAiSemanticFieldsForTable(tableName) {
  return AI_SEMANTIC_FIELDS.filter((f) => f.storage.table === tableName)
}

export function summarizeAiSemanticCatalog() {
  return {
    version: AI_SEMANTIC_CATALOG_VERSION,
    fieldCount: AI_SEMANTIC_FIELDS.length,
    queryableCount: listAiQueryableSemanticFields().length,
    inputCount: listAiInputSemanticFields().length,
    genericCustomerReadCount: listAiGenericCustomerReadFields().length,
    dataClassCounts: {
      USER_BUSINESS: listAiSemanticFieldsByDataClass(AI_SEMANTIC_DATA_CLASS.USER_BUSINESS).length,
      INTERNAL_SYSTEM: listAiSemanticFieldsByDataClass(AI_SEMANTIC_DATA_CLASS.INTERNAL_SYSTEM).length,
      SECRET_SECURITY: listAiSemanticFieldsByDataClass(AI_SEMANTIC_DATA_CLASS.SECRET_SECURITY).length,
    },
    domainCounts: {
      CUSTOMER: listAiSemanticFieldsByDomain(AI_SEMANTIC_DOMAIN.CUSTOMER).length,
      USER_WORKSPACE: listAiSemanticFieldsByDomain(AI_SEMANTIC_DOMAIN.USER_WORKSPACE).length,
      SYSTEM: listAiSemanticFieldsByDomain(AI_SEMANTIC_DOMAIN.SYSTEM).length,
    },
    managedTables: [...AI_SEMANTIC_MANAGED_TABLES],
  }
}
