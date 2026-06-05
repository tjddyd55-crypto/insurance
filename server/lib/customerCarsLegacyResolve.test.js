import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * PDF·고객상세 차량 fallback과 동일한 규칙을 검증한다.
 * 구현 SSOT: src/features/customers/utils/resolveCustomerCarsForDisplay.ts
 */

function trimStr(v) {
  return String(v ?? '').trim()
}

function hasAnyCarValue(car) {
  return !!(
    trimStr(car.carNumber) ||
    trimStr(car.carModel) ||
    trimStr(car.carYear) ||
    trimStr(car.renewalDate) ||
    trimStr(car.carType)
  )
}

function readNumbered(bag, index) {
  const keys = (base) => [`${base}${index}`, `car${index}${base.replace(/^car/, '')}`]
  const carNumber = keys('carNumber')
    .map((k) => bag[k])
    .find((v) => trimStr(v))
  const carModel = keys('carModel')
    .map((k) => bag[k])
    .find((v) => trimStr(v))
  return {
    carNumber: trimStr(carNumber),
    carModel: trimStr(carModel),
    carYear: '',
    renewalDate: '',
    carType: '',
  }
}

function extractNumberedLegacy(bag) {
  const cars = []
  for (let i = 1; i <= 5; i += 1) {
    const car = readNumbered(bag, i)
    if (hasAnyCarValue(car)) {
      cars.push(car)
    }
  }
  return cars
}

test('numbered legacy: carNumber1/carNumber2', () => {
  const cars = extractNumberedLegacy({
    carNumber1: '21가2121',
    carModel1: '그랜저',
    carNumber2: '22가2222',
    carModel2: '쏘렌토',
  })
  assert.equal(cars.length, 2)
  assert.equal(cars[0].carNumber, '21가2121')
  assert.equal(cars[1].carNumber, '22가2222')
})

test('numbered legacy: car1Number/car2Number', () => {
  const cars = extractNumberedLegacy({
    car1Number: '31가3131',
    car1Model: '모델1',
    car2Number: '32가3232',
    car2Model: '모델2',
  })
  assert.equal(cars.length, 2)
  assert.equal(cars[0].carNumber, '31가3131')
  assert.equal(cars[1].carNumber, '32가3232')
})
