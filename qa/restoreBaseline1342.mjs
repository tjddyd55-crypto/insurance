const API = 'http://127.0.0.1:3001/backend/api'
async function main() {
  const login = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'tjddyd55', password: 'QaBizFire20260910!' }),
  })
  const { token } = await login.json()
  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  const put = await fetch(API + '/customers/1342', {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({
      businessInfo: {
        representativeName: '홍길동',
        businessNumber: '123-45-67890',
        businessAddress: '서울특별시 테스트구 테스트로 10',
        memo: '경영인 정기보험 상담 예정',
      },
    }),
  })
  console.log('biz put', put.status, await put.json().then(j => j.businessInfo).catch(() => null))

  const fire = await (await fetch(API + '/customers/1342/fire-insurance-locations', { headers: h })).json()
  console.log('fire before', fire)
  for (const loc of fire.fireInsuranceLocations || []) {
    const d = await fetch(API + '/customers/1342/fire-insurance-locations/' + loc.id, { method: 'DELETE', headers: h })
    console.log('delete', loc.id, d.status)
  }

  const loc1 = await fetch(API + '/customers/1342/fire-insurance-locations', {
    method: 'POST', headers: h,
    body: JSON.stringify({ address: '서울특별시 테스트구 화재로 1', memo: '본사' }),
  })
  const loc1b = await loc1.json()
  console.log('loc1', loc1.status, loc1b)

  const loc2 = await fetch(API + '/customers/1342/fire-insurance-locations', {
    method: 'POST', headers: h,
    body: JSON.stringify({ address: '경기도 테스트시 창고로 20', memo: '물류창고' }),
  })
  const loc2b = await loc2.json()
  console.log('loc2', loc2.status, loc2b)

  const detail = await (await fetch(API + '/customers/1342', { headers: { Authorization: 'Bearer ' + token } })).json()
  console.log(JSON.stringify({ businessInfo: detail.businessInfo, fire: detail.fireInsuranceLocations }, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
