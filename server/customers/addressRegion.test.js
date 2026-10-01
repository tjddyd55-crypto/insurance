import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseKoreanAddressRegion,
  resolveCustomerAddressRegion,
} from './addressRegion.js'

const cases = [
  ['서울특별시 강남구 역삼동 123-4', '서울특별시', '강남구', '역삼동'],
  ['서울 강남구 테헤란로 152', '서울특별시', '강남구', null],
  ['서울시 강남구 테헤란로 152 (역삼동)', '서울특별시', '강남구', '역삼동'],
  ['(06236) 서울특별시 강남구 역삼동 123', '서울특별시', '강남구', '역삼동'],
  ['서울특별시 중구 세종대로 110', '서울특별시', '중구', null],
  ['서울특별시 중구 태평로1가 31', '서울특별시', '중구', '태평로1가'],
  ['부산광역시 해운대구 우동 123', '부산광역시', '해운대구', '우동'],
  ['부산 해운대구 우동', '부산광역시', '해운대구', '우동'],
  ['대구광역시 달성군 유가읍 123', '대구광역시', '달성군', '유가읍'],
  ['인천광역시 연수구 송도동 123', '인천광역시', '연수구', '송도동'],
  ['광주광역시 동구 충장로 1', '광주광역시', '동구', null],
  ['대전광역시 유성구 봉명동 1', '대전광역시', '유성구', '봉명동'],
  ['울산광역시 남구 삼산동 1', '울산광역시', '남구', '삼산동'],
  ['세종특별자치시 한솔동 123', '세종특별자치시', null, '한솔동'],
  ['세종특별자치시 도움3로 12', '세종특별자치시', null, null],
  ['세종시 어진동', '세종특별자치시', null, '어진동'],
  ['경기도 성남시 분당구 판교동 123', '경기도', '성남시 분당구', '판교동'],
  ['경기 성남시 분당구 판교역로 235', '경기도', '성남시 분당구', null],
  ['경기도 수원시 영통구 매탄동 1', '경기도', '수원시 영통구', '매탄동'],
  ['경기도 고양시 일산동구 장항동 1', '경기도', '고양시 일산동구', '장항동'],
  ['경기도 용인시 수지구 죽전동 1', '경기도', '용인시 수지구', '죽전동'],
  ['경기도 양평군 양평읍 양평리 1', '경기도', '양평군', '양평읍'],
  ['강원특별자치도 춘천시 효자동 1', '강원특별자치도', '춘천시', '효자동'],
  ['강원도 춘천시 효자동', '강원특별자치도', '춘천시', '효자동'],
  ['충청북도 청주시 서원구 모충동 1', '충청북도', '청주시 서원구', '모충동'],
  ['충북 청주시 흥덕구 복대동', '충청북도', '청주시 흥덕구', '복대동'],
  ['충청남도 천안시 서북구 불당동 1', '충청남도', '천안시 서북구', '불당동'],
  ['전북특별자치도 전주시 완산구 효자동 1', '전북특별자치도', '전주시 완산구', '효자동'],
  ['전라북도 전주시 덕진구 인후동', '전북특별자치도', '전주시 덕진구', '인후동'],
  ['전라남도 여수시 학동 1', '전라남도', '여수시', '학동'],
  ['경상북도 포항시 남구 해도동 1', '경상북도', '포항시 남구', '해도동'],
  ['경상북도 울릉군 울릉읍 도동리', '경상북도', '울릉군', '울릉읍'],
  ['경상남도 창원시 성산구 상남동 1', '경상남도', '창원시 성산구', '상남동'],
  ['경남 창원시 의창구 소답동', '경상남도', '창원시 의창구', '소답동'],
  ['제주특별자치도 제주시 연동 1', '제주특별자치도', '제주시', '연동'],
  ['제주특별자치도 서귀포시 중문동 1', '제주특별자치도', '서귀포시', '중문동'],
  ['제주 제주시 아라동', '제주특별자치도', '제주시', '아라동'],
  ['서울특별시 종로구 청운동 1-1', '서울특별시', '종로구', '청운동'],
  ['서울특별시 동대문구 전농동 청량리', '서울특별시', '동대문구', '전농동'],
]

describe('parseKoreanAddressRegion', () => {
  for (const [address, sido, sigungu, dong] of cases) {
    it(address, () => {
      const region = parseKoreanAddressRegion(address)
      assert.equal(region.addressSido, sido)
      assert.equal(region.addressSigungu, sigungu)
      assert.equal(region.addressEupmyeondong, dong)
    })
  }

  it('원문 주소를 바꾸지 않고 실패는 null', () => {
    const raw = '해외 123 Main Street'
    const region = parseKoreanAddressRegion(raw)
    assert.deepEqual(region, {
      addressSido: null,
      addressSigungu: null,
      addressEupmyeondong: null,
    })
    assert.equal(raw, '해외 123 Main Street')
  })

  it('빈 주소는 null', () => {
    assert.deepEqual(parseKoreanAddressRegion('   '), {
      addressSido: null,
      addressSigungu: null,
      addressEupmyeondong: null,
    })
  })
})

describe('resolveCustomerAddressRegion', () => {
  it('카카오 우편번호 필드를 주소 문자열보다 우선한다', () => {
    const region = resolveCustomerAddressRegion({
      address: '서울특별시 강남구 테헤란로 152',
      sido: '서울',
      sigungu: '강남구',
      bname: '역삼동',
    })
    assert.equal(region.addressSido, '서울특별시')
    assert.equal(region.addressSigungu, '강남구')
    assert.equal(region.addressEupmyeondong, '역삼동')
  })

  it('세종은 시군구를 비운다', () => {
    const region = resolveCustomerAddressRegion({
      addressSido: '세종특별자치시',
      addressSigungu: '세종시',
      addressEupmyeondong: '한솔동',
    })
    assert.equal(region.addressSido, '세종특별자치시')
    assert.equal(region.addressSigungu, null)
    assert.equal(region.addressEupmyeondong, '한솔동')
  })

  it('명시 필드가 없으면 저장된 주소를 파싱한다', () => {
    const region = resolveCustomerAddressRegion({
      address: '경기도 성남시 분당구 판교동 1',
    })
    assert.equal(region.addressSigungu, '성남시 분당구')
    assert.equal(region.addressEupmyeondong, '판교동')
  })

  it('읍/면이 있으면 리보다 읍면을 고른다', () => {
    const region = resolveCustomerAddressRegion({
      sido: '경기도',
      sigungu: '양평군',
      bname2: '양평읍',
      bname1: '양평리',
    })
    assert.equal(region.addressEupmyeondong, '양평읍')
  })
})
