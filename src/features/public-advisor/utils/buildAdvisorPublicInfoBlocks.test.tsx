import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdvisorPublicFactsList } from '../components/AdvisorPublicFactsList'
import { AdvisorPublicProfileView } from '../components/AdvisorPublicProfileView'
import { buildAdvisorPublicInfoBlocks } from './buildAdvisorPublicInfoBlocks'
import { resolveUserAffiliationText } from './resolveUserAffiliationText'

const CAREER = '2019년 보험업 시작\n현 보험GA협회 우수설계사 인증'

describe('public affiliation and office blocks', () => {
  it('shows only the affiliation the user saved', () => {
    const affiliationText = resolveUserAffiliationText({
      heroDisplaySubtitle: '영진에셋',
      heroDisplaySubtitleVisible: true,
    })
    const blocks = buildAdvisorPublicInfoBlocks({
      affiliationText,
      gaName: '영진에셋',
      teamName: '서울중앙 1팀',
      officeLine: '서울특별시 중구 세종대로 110 12층',
      careerText: CAREER,
      publicFax: '05044789523',
      showPublicFax: true,
    })
    expect(blocks.find((block) => block.label === '소속')?.value).toBe('영진에셋')
    expect(blocks.find((block) => block.label === '사무실')?.value).toBe('서울특별시 중구 세종대로 110 12층')
    expect(JSON.stringify(blocks)).not.toContain('서울중앙 1팀')
    const fax = blocks.find((block) => block.label === '팩스')
    expect(fax?.displayValue).toBe('0504-478-9523')
    expect(fax?.copyText).toBe('0504-478-9523')
  })

  it('omits 소속 when the user left the subtitle empty', () => {
    const blocks = buildAdvisorPublicInfoBlocks({
      affiliationText: resolveUserAffiliationText({
        heroDisplaySubtitle: '',
        heroDisplaySubtitleVisible: true,
      }),
      gaName: '영진에셋',
      teamName: '서울중앙 1팀',
    })
    expect(blocks.some((block) => block.label === '소속')).toBe(false)
  })
})

describe('career lines render with one typography class', () => {
  it('does not give later career lines a different class', () => {
    const blocks = buildAdvisorPublicInfoBlocks({
      careerText: CAREER,
    })
    const html = renderToStaticMarkup(<AdvisorPublicFactsList blocks={blocks} />)
    const lines = [...html.matchAll(/class="pap-facts__line"/g)]
    expect(lines).toHaveLength(2)
    expect(html).toContain('2019년 보험업 시작')
    expect(html).toContain('현 보험GA협회 우수설계사 인증')
    expect(html).not.toContain('pap-facts__line--')
  })

  it('does not restyle career lines after the first', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../public-advisor.css'),
      'utf8',
    )
    expect(css).not.toMatch(/\.pap-facts__line\s*\+\s*\.pap-facts__line/)
  })
})

describe('AdvisorPublicProfileView', () => {
  it('renders the saved subtitle, office, and career without the account team name', () => {
    const affiliationText = resolveUserAffiliationText({
      heroDisplaySubtitle: '영진에셋',
      heroDisplaySubtitleVisible: true,
    })
    const html = renderToStaticMarkup(
      <AdvisorPublicProfileView
        theme="classic"
        variant="preview"
        model={{
          displayName: '홍길동',
          gaName: '영진에셋',
          teamName: '서울중앙 1팀',
          heroDisplaySubtitle: '영진에셋',
          heroDisplaySubtitleVisible: true,
          profilePhotoUrl: null,
          affiliationLine: affiliationText,
          officeLine: '서울특별시 중구 세종대로 110 12층',
          headline: '',
          publicTags: [],
          phoneNumber: '',
          kakaoLink: '',
          allowConsultation: false,
          bio: '',
          businessCardFrontUrl: null,
          gallery: [],
          infoBlocks: buildAdvisorPublicInfoBlocks({
            affiliationText,
            gaName: '영진에셋',
            teamName: '서울중앙 1팀',
            careerText: CAREER,
            officeLine: '서울특별시 중구 세종대로 110 12층',
          }),
        }}
      />,
    )
    expect(html).toContain('영진에셋')
    expect(html).toContain('서울특별시 중구 세종대로 110 12층')
    expect(html).toContain('2019년 보험업 시작')
    expect(html).toContain('현 보험GA협회 우수설계사 인증')
    expect(html).not.toContain('서울중앙 1팀')
  })
})
