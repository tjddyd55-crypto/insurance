import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acquireDriveImportLock,
  downloadDriveFile,
  driveImportFileName,
  normalizeDriveFileId,
  readDriveFileMeta,
  sniffDriveMime,
} from './googleDriveService.js'
import { createDriveImport, invokeStorageHandler } from './googleDriveImport.js'
import { buildGoogleAuthorizationUrl } from './googleTokenService.js'
import { hasDriveFileScope, isGoogleDriveEnabled, readGooglePickerConfig } from './googleOAuthConfig.js'

const PDF = Buffer.from('%PDF-1.4\n%test\n')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
const FID = 'abcDEF123_-xyz'

function res(status, body, raw) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length),
  }
}
function driveFetch(meta, bytes, calls = []) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET' })
    const u = new URL(String(url))
    if (u.searchParams.get('alt') === 'media') return res(200, null, bytes)
    if (meta === 404) return res(404, {}, Buffer.alloc(0))
    return res(200, meta, Buffer.alloc(0))
  }
}

describe('drive config / consent', () => {
  it('flag·Picker 설정 없으면 비활성(graceful)', () => {
    assert.equal(isGoogleDriveEnabled({}), false)
    assert.equal(readGooglePickerConfig({}).configured, false)
    assert.equal(readGooglePickerConfig({ GOOGLE_PICKER_API_KEY: 'k', GOOGLE_PICKER_APP_ID: '519459236516' }).configured, true)
    assert.equal(readGooglePickerConfig({ GOOGLE_PICKER_API_KEY: 'k', GOOGLE_PICKER_APP_ID: 'abc' }).configured, false)
    assert.equal(hasDriveFileScope('https://www.googleapis.com/auth/drive.file'), true)
    assert.equal(hasDriveFileScope('https://www.googleapis.com/auth/drive.readonly'), false)
  })
  it('Drive 동의 URL: drive.file 만 추가, 넓은 drive scope 없음, 증분·같은 계정', () => {
    const url = new URL(buildGoogleAuthorizationUrl({ clientId: 'c', redirectUri: 'https://x/cb' }, 's', { purpose: 'drive', loginHint: 'a@b.c' }))
    const scopes = url.searchParams.get('scope').split(' ')
    assert.ok(scopes.includes('https://www.googleapis.com/auth/drive.file'))
    assert.ok(!scopes.some((s) => /auth\/drive($|\.readonly|\.metadata)/.test(s)))
    assert.ok(!scopes.includes('https://www.googleapis.com/auth/calendar.events'))
    assert.equal(url.searchParams.get('include_granted_scopes'), 'true')
    assert.equal(url.searchParams.get('prompt'), 'consent')
    assert.equal(url.searchParams.get('login_hint'), 'a@b.c')
  })
})

describe('drive file validation', () => {
  it('id 형식 검사', () => {
    assert.equal(normalizeDriveFileId(FID), FID)
    assert.throws(() => normalizeDriveFileId('../etc'), { code: 'drive_file_invalid' })
    assert.throws(() => normalizeDriveFileId(''), { code: 'drive_file_invalid' })
  })
  it('파일 이름 정리 + 실제 형식 확장자', () => {
    assert.equal(driveImportFileName('a/b:c.PDF', 'application/pdf'), 'a b c.pdf')
    assert.equal(driveImportFileName('', 'image/png'), 'google-drive.png')
  })
  it('허용 형식·용량·휴지통·Docs 거절, 남의 파일(404) 거절', async () => {
    const meta = (m) => readDriveFileMeta({ accessToken: 't', fetchImpl: driveFetch(m, PDF) }, FID)
    assert.equal((await meta({ id: FID, name: 'x.pdf', mimeType: 'application/pdf', size: '15' })).size, 15)
    await assert.rejects(meta({ id: FID, name: 'd', mimeType: 'application/vnd.google-apps.document' }), { code: 'drive_file_type' })
    await assert.rejects(meta({ id: FID, name: 'z.zip', mimeType: 'application/zip', size: '5' }), { code: 'drive_file_type' })
    await assert.rejects(meta({ id: FID, name: 'x.pdf', mimeType: 'application/pdf', size: String(26 * 1024 * 1024) }), { code: 'drive_file_too_large' })
    await assert.rejects(meta({ id: FID, name: 'x.pdf', mimeType: 'application/pdf', size: '5', trashed: true }), { code: 'drive_file_not_found' })
    await assert.rejects(meta(404), { code: 'drive_file_not_found' })
  })
  it('다운로드: 크기 불일치·시그니처 위장 거절, Drive 에는 GET 만', async () => {
    const calls = []
    const ok = await downloadDriveFile({ accessToken: 't', fetchImpl: driveFetch({}, PDF, calls) }, { id: FID, size: PDF.length, mimeType: 'application/pdf' })
    assert.equal(ok.length, PDF.length)
    await assert.rejects(downloadDriveFile({ accessToken: 't', fetchImpl: driveFetch({}, PDF) }, { id: FID, size: PDF.length + 1, mimeType: 'application/pdf' }), { code: 'drive_file_size_mismatch' })
    await assert.rejects(downloadDriveFile({ accessToken: 't', fetchImpl: driveFetch({}, PNG) }, { id: FID, size: PNG.length, mimeType: 'application/pdf' }), { code: 'drive_file_type' })
    assert.ok(calls.every((call) => call.method === 'GET'))
    assert.equal(sniffDriveMime(PNG), 'image/png')
  })
  it('같은 파일 동시 가져오기 잠금', () => {
    const release = acquireDriveImportLock('u1', FID)
    assert.throws(() => acquireDriveImportLock('u1', FID), { code: 'drive_import_in_progress' })
    acquireDriveImportLock('u2', FID)()
    release()
    acquireDriveImportLock('u1', FID)()
  })
})

describe('drive import reuses storage path', () => {
  const connectedPool = (scope = 'https://www.googleapis.com/auth/drive.file') => ({
    query: async () => ({ rowCount: 1, rows: [] }),
  })
  // assertGoogleDriveReady 는 integrationStore 를 읽으므로 env·pool 대신 import 전체 흐름은 핸들러 주입으로 검증한다.
  it('invokeStorageHandler 는 원 요청의 user 를 유지하고 body 만 바꾼다', async () => {
    const req = { user: { id: 'u1', gaId: 3 }, body: { evil: 1 }, query: { x: 1 } }
    const out = await invokeStorageHandler(async (r, s, forced) => { s.status(201).json({ user: r.user.id, body: r.body, q: r.query, forced }) }, req, { a: 1 }, '7')
    assert.deepEqual(out.body, { user: 'u1', body: { a: 1 }, q: {}, forced: '7' })
    assert.equal(out.status, 201)
    assert.deepEqual(req.body, { evil: 1 })
  })
  it('flag OFF 면 Drive·저장소를 건드리지 않는다', async () => {
    const prev = process.env.GOOGLE_DRIVE_ENABLED
    delete process.env.GOOGLE_DRIVE_ENABLED
    let touched = false
    const run = createDriveImport({ pool: connectedPool(), handlers: { presign: async () => { touched = true }, save: async () => {}, revoke: async () => {} }, putObject: async () => { touched = true }, withAccess: async () => { touched = true } })
    const out = await run({ user: { id: 'u1' } }, { driveFileId: FID })
    assert.equal(out.status, 403)
    assert.equal(out.body.code, 'drive_disabled')
    assert.equal(touched, false)
    if (prev !== undefined) process.env.GOOGLE_DRIVE_ENABLED = prev
  })

  const meta = { id: FID, name: '보장분석.pdf', mimeType: 'application/pdf', size: String(PDF.length) }
  const deps = (over = {}) => {
    const log = []
    return {
      log,
      deps: {
        pool: {},
        assertReady: async () => {},
        fetchImpl: driveFetch(meta, PDF),
        withAccess: async (_u, run) => run('tok'),
        putObject: async (key, buf, type) => { log.push(['put', key, buf.length, type]); if (over.putFail) throw new Error('r2 down') },
        handlers: {
          presign: async (r, s, forced) => { log.push(['presign', r.body, forced]); if (over.presignStatus) return s.status(over.presignStatus).json({ message: '저장 공간 한도를 초과했습니다.' }); s.json({ fileId: 9, objectKey: 'ga/u1/k.pdf', fileUrl: 'https://r2/k.pdf' }) },
          save: async (r, s) => { log.push(['save', r.body]); if (over.saveStatus) return s.status(over.saveStatus).json({ message: 'x' }); s.json({ id: '9', displayName: r.body.displayName }) },
          revoke: async (r, s) => { log.push(['revoke', r.body]); s.json({ ok: true }) },
        },
      },
    }
  }
  it('성공: presign → R2 put → save 순서, 실제 크기·형식', async () => {
    const { log, deps: d } = deps()
    const out = await createDriveImport(d)({ user: { id: 'u1' } }, { driveFileId: FID, forcedCustomerId: '42' })
    assert.equal(out.status, 200)
    assert.equal(out.body.source, 'google_drive')
    assert.deepEqual(log.map((x) => x[0]), ['presign', 'put', 'save'])
    assert.equal(log[0][1].size, PDF.length)
    assert.equal(log[0][2], '42')
    assert.equal(log[1][3], 'application/pdf')
  })
  it('한도 초과 등 presign 거절은 그대로 전달, R2 put 없음', async () => {
    const { log, deps: d } = deps({ presignStatus: 400 })
    const out = await createDriveImport(d)({ user: { id: 'u1' } }, { driveFileId: FID })
    assert.equal(out.status, 400)
    assert.ok(!log.some((x) => x[0] === 'put'))
  })
  it('R2 실패·save 실패 시 staged 정리(revoke), 부분 저장 없음', async () => {
    for (const over of [{ putFail: true }, { saveStatus: 403 }]) {
      const { log, deps: d } = deps(over)
      const run = createDriveImport(d)
      if (over.putFail) await assert.rejects(run({ user: { id: 'u1' } }, { driveFileId: FID }))
      else assert.equal((await run({ user: { id: 'u1' } }, { driveFileId: FID })).status, 403)
      assert.deepEqual(log.find((x) => x[0] === 'revoke')[1], { fileId: 9, objectKey: 'ga/u1/k.pdf' })
    }
  })
  it('남의/고르지 않은 Drive 파일(404) → 저장소 접근 없음', async () => {
    const { log, deps: d } = deps()
    d.fetchImpl = driveFetch(404, PDF)
    const out = await createDriveImport(d)({ user: { id: 'u1' } }, { driveFileId: FID })
    assert.equal(out.status, 404)
    assert.equal(log.length, 0)
  })
})
