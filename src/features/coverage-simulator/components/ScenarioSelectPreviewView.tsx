import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { startConsultationFromSystemDisease, startConsultationFromUserTemplate } from '../domain/startConsultation'
import { listSystemTemplateSummaries } from '../domain/systemTemplateCatalog'
import type { DiseaseType } from '../domain/types'
import { cloneUserTemplate } from '../domain/templateOperations'
import { deleteUserTemplate, getUserTemplateById, listUserTemplates, saveUserTemplate } from '../storage/templateRepository'

type Props = {
  layoutMode: 'preview-pc' | 'preview-mobile'
}

export function ScenarioSelectPreviewView({ layoutMode }: Props) {
  const navigate = useNavigate()
  const { basePath, userKey } = useCoverageSimulatorScope()
  const isPc = layoutMode === 'preview-pc'
  const [menuTemplateId, setMenuTemplateId] = useState<string | null>(null)

  const systemCards = listSystemTemplateSummaries()
  const myTemplates = listUserTemplates(userKey)

  const startSystem = (diseaseType: DiseaseType) => {
    const saved = startConsultationFromSystemDisease(userKey, diseaseType)
    if (saved) navigate(`${basePath}/scenarios/${saved.id}`)
  }

  const startUser = (templateId: string) => {
    const template = getUserTemplateById(userKey, templateId)
    if (!template) return
    const saved = startConsultationFromUserTemplate(userKey, template)
    navigate(`${basePath}/scenarios/${saved.id}`)
  }

  const onDeleteTemplate = (templateId: string) => {
    if (!window.confirm('이 시나리오 템플릿을 삭제할까요?')) return
    deleteUserTemplate(userKey, templateId)
    setMenuTemplateId(null)
  }

  const onDuplicate = (templateId: string) => {
    const source = getUserTemplateById(userKey, templateId)
    if (!source) return
    const copy = saveUserTemplate(userKey, cloneUserTemplate(source))
    setMenuTemplateId(null)
    navigate(`${basePath}/templates/${copy.id}/edit`)
  }

  const onRename = (templateId: string) => {
    const source = getUserTemplateById(userKey, templateId)
    if (!source) return
    const nextName = window.prompt('시나리오 이름', source.name)
    if (!nextName?.trim()) return
    saveUserTemplate(userKey, { ...source, name: nextName.trim() })
    setMenuTemplateId(null)
  }

  return (
    <>
      <section className="cs-select-section">
        <h2 className="cs-select-section__title">기본 시나리오</h2>
        <div className={`cs-select-grid${isPc ? ' cs-select-grid--pc' : ''}`}>
          {systemCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`coverage-simulator-scenario-card${card.enabled ? '' : ' coverage-simulator-scenario-card--disabled'}`}
              disabled={!card.enabled}
              onClick={() => card.enabled && startSystem(card.diseaseType)}
            >
              <div className="coverage-simulator-scenario-card__title">{card.name}</div>
              <div className="coverage-simulator-scenario-card__desc">{card.description}</div>
              {card.enabled ? (
                <div className="cs-template-card__meta">{card.itemCount}개 항목</div>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="cs-select-section">
        <div className="cs-select-section__head">
          <h2 className="cs-select-section__title">내 시나리오</h2>
          {isPc ? (
            <button
              type="button"
              className="coverage-simulator-primary-btn cs-select-new-btn"
              onClick={() => navigate(`${basePath}/templates/new`)}
            >
              + 새 시나리오
            </button>
          ) : null}
        </div>
        {myTemplates.length === 0 ? (
          <p className="coverage-simulator-page-desc">아직 저장한 시나리오가 없습니다.</p>
        ) : (
          <div className={`cs-select-grid${isPc ? ' cs-select-grid--pc' : ''}`}>
            {myTemplates.map((template) => (
              <div key={template.id} className="cs-template-card-wrap">
                <button
                  type="button"
                  className="coverage-simulator-scenario-card cs-template-card"
                  onClick={() => startUser(template.id)}
                >
                  <div className="coverage-simulator-scenario-card__title">{template.name}</div>
                  {template.description ? (
                    <div className="coverage-simulator-scenario-card__desc">{template.description}</div>
                  ) : null}
                  <div className="cs-template-card__meta">
                    {template.itemCount}개 항목 · {template.updatedAt.slice(0, 10)}
                  </div>
                </button>
                <button
                  type="button"
                  className="cs-template-card__menu"
                  aria-label="템플릿 메뉴"
                  onClick={() => setMenuTemplateId(menuTemplateId === template.id ? null : template.id)}
                >
                  ⋯
                </button>
                {menuTemplateId === template.id ? (
                  <div className="cs-template-card__menu-panel" role="menu">
                    <button type="button" onClick={() => startUser(template.id)}>이 시나리오로 상담 시작</button>
                    <button type="button" onClick={() => navigate(`${basePath}/templates/${template.id}/edit`)}>
                      템플릿 수정
                    </button>
                    <button type="button" onClick={() => onDuplicate(template.id)}>복제</button>
                    <button type="button" onClick={() => onRename(template.id)}>이름 변경</button>
                    <button type="button" className="cs-axis-row-menu__danger" onClick={() => onDeleteTemplate(template.id)}>
                      삭제
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        className={`coverage-simulator-primary-btn cs-select-new-cta${isPc ? ' cs-select-new-cta--pc' : ''}`}
        onClick={() => navigate(`${basePath}/templates/new`)}
      >
        + 새 시나리오 만들기
      </button>

      <button
        type="button"
        className="coverage-simulator-secondary-btn"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => navigate(`${basePath}/saved`)}
      >
        저장된 상담 불러오기
      </button>
    </>
  )
}
