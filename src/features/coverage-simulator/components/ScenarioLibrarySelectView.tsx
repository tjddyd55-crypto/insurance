import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CustomerContextBar } from './CustomerContextBar'
import { useCoverageSimulatorCustomer } from '../context/CoverageSimulatorCustomerContext'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { cloneUserTemplate, createEmptyUserTemplate } from '../domain/templateOperations'
import {
  deleteScenarioTemplate,
  getScenarioTemplateById,
  listScenarioTemplates,
  saveScenarioTemplate,
} from '../storage/templateRepository'

type Props = {
  layoutMode: 'crm' | 'preview-pc' | 'preview-mobile'
}

export function ScenarioLibrarySelectView({ layoutMode }: Props) {
  const navigate = useNavigate()
  const { basePath, userKey } = useCoverageSimulatorScope()
  const { draft: customerDraft } = useCoverageSimulatorCustomer()
  const isPc = layoutMode === 'preview-pc' || layoutMode === 'crm'
  const [menuTemplateId, setMenuTemplateId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')

  const templates = listScenarioTemplates(userKey)
  void refreshTick

  const bumpList = useCallback(() => setRefreshTick((n) => n + 1), [])

  useEffect(() => {
    if (!menuTemplateId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuTemplateId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuTemplateId])

  const openSimulationList = (templateId: string) => {
    navigate(`${basePath}/templates/${templateId}/simulations`)
  }

  const openScenarioEdit = (templateId: string) => {
    navigate(`${basePath}/templates/${templateId}/edit`)
  }

  const onDeleteTemplate = (templateId: string) => {
    const source = getScenarioTemplateById(userKey, templateId)
    if (!source) return
    const ok = window.confirm(
      '시나리오를 삭제할까요?\n\n이 시나리오를 삭제합니다. 이미 저장된 시뮬레이션은 영향을 받지 않습니다.',
    )
    if (!ok) return
    deleteScenarioTemplate(userKey, templateId)
    setMenuTemplateId(null)
    bumpList()
  }

  const onDuplicate = (templateId: string) => {
    const source = getScenarioTemplateById(userKey, templateId)
    if (!source) return
    const copy = saveScenarioTemplate(userKey, cloneUserTemplate(source))
    setMenuTemplateId(null)
    bumpList()
    navigate(`${basePath}/templates/${copy.id}/edit`)
  }

  const onRename = (templateId: string) => {
    const source = getScenarioTemplateById(userKey, templateId)
    if (!source) return
    const nextName = window.prompt('시나리오 이름', source.name)
    if (!nextName?.trim()) return
    saveScenarioTemplate(userKey, { ...source, name: nextName.trim() })
    setMenuTemplateId(null)
    bumpList()
  }

  const onCreateScenario = () => {
    const name = newScenarioName.trim()
    if (!name) return
    const saved = saveScenarioTemplate(userKey, createEmptyUserTemplate(name))
    setAddModalOpen(false)
    setNewScenarioName('')
    bumpList()
    navigate(`${basePath}/templates/${saved.id}/edit`)
  }

  const savedSimulationsLabel =
    layoutMode === 'crm' ? '저장된 상담 불러오기' : '저장된 시뮬레이션'

  return (
    <>
      {layoutMode !== 'crm' ? <CustomerContextBar /> : null}
      <section className="cs-select-section">
        <div className="cs-select-section__head">
          <h2 className="cs-select-section__title">시나리오</h2>
          {isPc ? (
            <button
              type="button"
              className="coverage-simulator-primary-btn cs-select-new-btn"
              onClick={() => setAddModalOpen(true)}
            >
              + 시나리오 추가
            </button>
          ) : null}
        </div>
        {templates.length === 0 ? (
          <p className="coverage-simulator-page-desc">시나리오가 없습니다. 새로 추가해 보세요.</p>
        ) : (
          <div className={`cs-select-grid${isPc ? ' cs-select-grid--pc' : ''}`}>
            {templates.map((template) => (
              <div key={template.id} className="cs-template-card-wrap">
                <button
                  type="button"
                  className="coverage-simulator-scenario-card cs-template-card"
                  onClick={() => openSimulationList(template.id)}
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
                  aria-label="시나리오 메뉴"
                  onClick={() => setMenuTemplateId(menuTemplateId === template.id ? null : template.id)}
                >
                  ⋯
                </button>
                {menuTemplateId === template.id ? (
                  <div className="cs-template-card__menu-panel" role="menu">
                    <button type="button" onClick={() => openScenarioEdit(template.id)}>
                      기본값 편집
                    </button>
                    <button type="button" onClick={() => onRename(template.id)}>
                      이름 변경
                    </button>
                    <button type="button" onClick={() => onDuplicate(template.id)}>
                      복제
                    </button>
                    <button
                      type="button"
                      className="cs-axis-row-menu__danger"
                      onClick={() => onDeleteTemplate(template.id)}
                    >
                      삭제
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {!isPc ? (
        <button
          type="button"
          className={`coverage-simulator-primary-btn cs-select-new-cta${isPc ? ' cs-select-new-cta--pc' : ''}`}
          onClick={() => setAddModalOpen(true)}
        >
          + 시나리오 추가
        </button>
      ) : null}

      <button
        type="button"
        className="coverage-simulator-secondary-btn"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => navigate(`${basePath}/saved`)}
      >
        {savedSimulationsLabel}
      </button>

      {addModalOpen ? (
        <div
          className="coverage-simulator-overlay"
          role="presentation"
          onClick={() => setAddModalOpen(false)}
        >
          <div
            className="coverage-simulator-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cs-add-scenario-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cs-add-scenario-title" className="coverage-simulator-dialog__title">
              시나리오 추가
            </h2>
            <label className="cs-template-form-field">
              <span>시나리오 이름</span>
              <input
                className="coverage-simulator-input"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                placeholder="예: 갑상선암 치료"
                autoFocus
              />
            </label>
            <div className="coverage-simulator-dialog__actions">
              <button
                type="button"
                className="coverage-simulator-secondary-btn"
                onClick={() => setAddModalOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="coverage-simulator-primary-btn"
                disabled={!newScenarioName.trim()}
                onClick={onCreateScenario}
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
