import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const editFormPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'CustomerEditForm.tsx',
)
const editFormSource = readFileSync(editFormPath, 'utf8')

test('CustomerEditForm imports business and fire insurance field editors', () => {
  assert.match(
    editFormSource,
    /import \{ CustomerBusinessInfoFields \} from '\.\/CustomerBusinessInfoFields'/,
  )
  assert.match(
    editFormSource,
    /import \{ CustomerFireInsuranceLocationsEditor \} from '\.\/CustomerFireInsuranceLocationsEditor'/,
  )
})

test('CustomerEditForm insurance layout references required field sections', () => {
  assert.match(editFormSource, /<CustomerBusinessInfoFields/)
  assert.match(editFormSource, /<CustomerFireInsuranceLocationsEditor/)
  assert.match(editFormSource, /<CustomerMedicalHistoryFields/)
  assert.match(editFormSource, /<CustomerSpecialDatesEditor/)
  assert.match(editFormSource, /<CustomerCarsEditor/)
  assert.match(editFormSource, /editForm\.businessInfo/)
  assert.match(editFormSource, /editForm\.fireInsuranceLocations/)
})
