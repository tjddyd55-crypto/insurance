import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

/**
 * gaTenantMenu.ts 는 프론트 전용이나, 메뉴 정책 회귀 방지를 위해 동일 상수를 여기서 검증한다.
 * (빌드 파이프라인에서 TS import 없이 문자열 기준만 고정)
 */
const INSURER_MANAGER_MENU_PATHS = ['/insurer/news', '/insurer/news/upload']
const LOSS_ADJUSTER_MENU_PATHS = ['/adjuster/news', '/adjuster/news/upload']
const DESIGNER_PATH_PREFIXES = ['/customers', '/claim-requests', '/storage', '/team/']

describe('special newsletter account menu policy', () => {
  test('insurer manager menu excludes designer paths', () => {
    for (const path of INSURER_MANAGER_MENU_PATHS) {
      assert.ok(path.startsWith('/insurer/'))
    }
    for (const blocked of DESIGNER_PATH_PREFIXES) {
      assert.equal(INSURER_MANAGER_MENU_PATHS.includes(blocked), false)
    }
    assert.equal(INSURER_MANAGER_MENU_PATHS.includes('/insurance/insurer-sites'), false)
  })

  test('loss adjuster menu excludes designer paths', () => {
    for (const path of LOSS_ADJUSTER_MENU_PATHS) {
      assert.ok(path.startsWith('/adjuster/'))
    }
    assert.equal(LOSS_ADJUSTER_MENU_PATHS.includes('/insurance/insurer-sites'), false)
  })
})
