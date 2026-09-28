import { useState } from 'react'

import { useCoverageSimulatorCrmStorage } from '../context/CoverageSimulatorCrmStorageContext'
import { useNavigate } from 'react-router-dom'

import { useConfirmDialog } from '../../../components/dialog'
import useIsMobile from '../../../hooks/useIsMobile'
import { CustomerContextBar } from './CustomerContextBar'
import { useCoverageSimulatorCustomer } from '../context/CoverageSimulatorCustomerContext'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { startConsultationFromUserTemplate } from '../domain/startConsultation'
import { listSystemTemplateSummaries } from '../domain/systemTemplateCatalog'
import { cloneUserTemplate } from '../domain/templateOperations'
import {
  deleteUserTemplateAsync,
  duplicateUserTemplateAsync,
  getUserTemplateById,
  listUserTemplates,
  saveUserTemplateAsync,
} from '../storage/templateRepository'
import { isPreviewUserKey } from '../storage/previewStorageKeys'

export function ScenarioSelectPreviewView() {
  const navigate = useNavigate()
  const { basePath, userKey, layoutMode } = useCoverageSimulatorScope()
  const { draft: customerDraft } = useCoverageSimulatorCustomer()
  const isMobile = useIsMobile()
  const isPc = layoutMode === 'preview-pc' || (layoutMode === 'crm' && !isMobile)
  const { confirm, confirmDialog } = useConfirmDialog()
  const [menuTemplateId, setMenuTemplateId] = useState<string | null>(null)
  const { version: storageVersion } = useCoverageSimulatorCrmStorage()

  const systemCards = listSystemTemplateSummaries()
  const myTemplates = listUserTemplates(userKey)
  void storageVersion

  const openDiseaseList = (diseaseType: string) => {
    navigate(`${basePath}/${diseaseType}`)
  }

  const startUser = async (templateId: string) => {
    const template = getUserTemplateById(userKey, templateId)
    if (!template) return
    try {
      const saved = await startConsultationFromUserTemplate(userKey, template, customerDraft)
      navigate(`${basePath}/scenarios/${saved.id}`)
    } catch {
      window.alert('시뮬레이션을 시작하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  const onDeleteTemplate = async (templateId: string) => {
    const source = getUserTemplateById(userKey, templateId)
    if (!source) return
    const accepted = await confirm({
      title: '시나리오를 삭제할까요?',
      message: `'${source.name}' 시나리오가 삭제됩니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!accepted) return
    try {
      await deleteUserTemplateAsync(userKey, templateId)
      setMenuTemplateId(null)
    } catch {
      window.alert('삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  const onDuplicate = async (templateId: string) => {
    const source = getUserTemplateById(userKey, templateId)
    if (!source) return
    try {
      const copy = isPreviewUserKey(userKey)
        ? await saveUserTemplateAsync(userKey, cloneUserTemplate(source))
        : await duplicateUserTemplateAsync(userKey, templateId)
      setMenuTemplateId(null)
      navigate(`${basePath}/templates/${copy.id}/edit`)
    } catch {
      window.alert('복제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  const onRename = async (templateId: string) => {
    const source = getUserTemplateById(userKey, templateId)
    if (!source) return
    const nextName = window.prompt('시나리오 이름', source.name)
    if (!nextName?.trim()) return
    try {
      await saveUserTemplateAsync(userKey, { ...source, name: nextName.trim() })
      setMenuTemplateId(null)
    } catch {
      window.alert('이름을 변경하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  return (
    <>
      <CustomerContextBar />
      <section className="cs-select-section">
        <h2 className="cs-select-section__title">기본 시나리오</h2>
        <div className={`cs-select-grid${isPc ? ' cs-select-grid--pc' : ''}`}>
          {systemCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="coverage-simulator-scenario-card"
              onClick={() => openDiseaseList(card.diseaseType)}
            >
              <div className="coverage-simulator-scenario-card__title">{card.name}</div>
              <div className="coverage-simulator-scenario-card__desc">{card.description}</div>
              <div className="cs-template-card__meta">{card.itemCount}개 항목</div>
            </button>
          ))}
        </div>
      </section>

      <section className="cs-select-section">
        <div className="cs-select-section__head">
          <h2 className="cs-select-section__title">나의 시나리오</h2>
          {isPc ? (
            <button
              type="button"
              className="coverage-simulator-primary-btn cs-select-new-btn"
              onClick={() => navigate(`${basePath}/templates/new`)}
            >
              + 시나리오 추가
            </button>
          ) : null}
        </div>
        {myTemplates.length === 0 ? (
          <p className="coverage-simulator-page-desc">아직 만든 시나리오가 없습니다.</p>
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
                  aria-label="시나리오 메뉴"
                  onClick={() => setMenuTemplateId(menuTemplateId === template.id ? null : template.id)}
                >
                  ⋯
                </button>
                {menuTemplateId === template.id ? (
                  <div className="cs-template-card__menu-panel" role="menu">
                    <button type="button" onClick={() => startUser(template.id)}>사용</button>
                    <button type="button" onClick={() => navigate(`${basePath}/templates/${template.id}/edit`)}>
                      시나리오 수정
                    </button>
                    <button type="button" onClick={() => onDuplicate(template.id)}>복제</button>
                    <button type="button" onClick={() => onRename(template.id)}>이름 변경</button>
                    <button
                      type="button"
                      className="cs-axis-row-menu__danger"
                      onClick={() => void onDeleteTemplate(template.id)}
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

      <button
        type="button"
        className={`coverage-simulator-primary-btn cs-select-new-cta${isPc ? ' cs-select-new-cta--pc' : ''}`}
        onClick={() => navigate(`${basePath}/templates/new`)}
      >
        + 시나리오 추가
      </button>

      <button
        type="button"
        className="coverage-simulator-secondary-btn"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => navigate(`${basePath}/saved`)}
      >
        저장된 시뮬레이션
      </button>
      {confirmDialog}
    </>
  )
}
