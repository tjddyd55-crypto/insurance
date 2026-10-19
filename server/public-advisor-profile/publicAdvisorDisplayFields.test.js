import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOfficeDisplayLine, resolvePublicAffiliationLine } from './publicAdvisorDisplayFields.js'
import { mapPublicProfilePayload } from './registerPublicAdvisorProfileApi.js'

test('affiliation line is the saved hero subtitle, not ga plus team', () => {
  assert.equal(
    resolvePublicAffiliationLine({
      heroDisplaySubtitle: '영진에셋',
      heroDisplaySubtitleVisible: true,
      gaName: '영진에셋',
      teamName: '서울중앙 1팀',
    }),
    '영진에셋',
  )
  assert.equal(
    resolvePublicAffiliationLine({
      hero_display_subtitle: '영진에셋',
      hero_display_subtitle_visible: true,
    }),
    '영진에셋',
  )
})

test('affiliation line stays empty when the user did not set a subtitle', () => {
  assert.equal(
    resolvePublicAffiliationLine({
      heroDisplaySubtitle: '   ',
      gaName: '영진에셋',
      teamName: '서울중앙 1팀',
    }),
    '',
  )
  assert.equal(
    resolvePublicAffiliationLine({
      heroDisplaySubtitle: '영진에셋',
      heroDisplaySubtitleVisible: false,
    }),
    '',
  )
})

test('public profile serializer exposes user affiliation and office line', () => {
  const payload = mapPublicProfilePayload(
    {
      profile: {
        slug: 'hong',
        headline: '',
        bio: '',
        hashtags: [],
        titleLabel: null,
        careerText: '2019년 보험업 시작',
        officeLine: '서울특별시 중구 세종대로 110 12층',
        heroDisplaySubtitle: '영진에셋',
        heroDisplaySubtitleVisible: true,
        allowConsultation: true,
        profileTheme: 'classic',
      },
      user: {
        displayName: '홍길동',
        gaName: '영진에셋',
        teamName: '서울중앙 1팀',
        phoneNumber: '',
        kakaoLink: '',
      },
      gallery: [],
      verificationBadges: [],
    },
    null,
  )
  assert.equal(payload.affiliationLine, '영진에셋')
  assert.equal(payload.officeLine, '서울특별시 중구 세종대로 110 12층')
  assert.equal(payload.teamName, '서울중앙 1팀')
  assert.notEqual(payload.affiliationLine, '영진에셋 서울중앙 1팀')
})

test('office line keeps road address and detail in separate columns then joins them', () => {
  assert.equal(
    buildOfficeDisplayLine({
      office_road_address: '서울특별시 중구 세종대로 110',
      office_address_detail: '12층',
    }),
    '서울특별시 중구 세종대로 110 12층',
  )
  assert.equal(
    buildOfficeDisplayLine({
      officeRoadAddress: '서울특별시 중구 세종대로 110',
      officeAddressDetail: '12층',
    }),
    '서울특별시 중구 세종대로 110 12층',
  )
  assert.equal(buildOfficeDisplayLine({ office_address_detail: '12층' }), '12층')
  assert.equal(buildOfficeDisplayLine({}), '')
})
