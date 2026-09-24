import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { buildSystemTemplateSnapshot, listSystemTemplateSummaries } from '../domain/systemTemplateCatalog'
import type { DiseaseType } from '../domain/types'
import { cloneUserTemplate, createEmptyUserTemplate } from '../domain/templateOperations'
import type { ScenarioTemplate } from '../domain/templateTypes'
import { getUserTemplateById, listUserTemplates, saveUserTemplate } from '../storage/templateRepository'

export function NewScenarioTemplatePage() {
  const navigate = useNavigate()
  const { basePath, userKey, layoutMode } = useCoverageSimulatorScope()
  const isPc = layoutMode === 'preview-pc'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [step, setStep] = useState<'choose' | 'copy'>('choose')

  const userSummaries = listUserTemplates(userKey)
  const systemTemplates = listSystemTemplateSummaries().filter((row) => row.enabled)

  const finishCreate = (template: ScenarioTemplate) => {
    const saved = saveUserTemplate(userKey, template)
    navigate(`${basePath}/templates/${saved.id}/edit`, { replace: true })
  }

  const onEmptyStart = () => {
    if (!name.trim()) return
    finishCreate(createEmptyUserTemplate(name, description))
  }

  const onCopyFromTemplate = (source: ScenarioTemplate) => {
    finishCreate(
      cloneUserTemplate(source, {
        name: name.trim() || `${source.name} (복사)`,
        description: description || source.description,
      }),
    )
  }

  const onPickCopySource = (sourceId: string) => {
    if (sourceId.startsWith('system:')) {
      const diseaseType = sourceId.replace('system:', '') as DiseaseType
      const snapshot = buildSystemTemplateSnapshot(diseaseType)
      if (snapshot) {
        onCopyFromTemplate({ ...snapshot, sourceType: 'user' })
      }
      return
    }
    const full = getUserTemplateById(userKey, sourceId)
    if (full) onCopyFromTemplate(full)
  }

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar">
        <button type="button" className="coverage-simulator-icon-btn" onClick={() => navigate(basePath)}>
          ←
        </button>
        <div className="coverage-simulator-appbar__title">새 시나리오</div>
        <span />
      </header>
      <main className={`coverage-simulator-content${isPc ? ' coverage-simulator-content--pc-select' : ''}`}>
        <h1 className="coverage-simulator-page-title">새 시나리오 만들기</h1>
        <label className="cs-template-form-field">
          <span>시나리오 이름</span>
          <input
            className="coverage-simulator-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 용종 제거 플랜"
          />
        </label>
        <label className="cs-template-form-field">
          <span>설명 (선택)</span>
          <input
            className="coverage-simulator-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="간단한 설명"
          />
        </label>

        {step === 'choose' ? (
          <div className="cs-template-create-actions">
            <button
              type="button"
              className="coverage-simulator-primary-btn"
              disabled={!name.trim()}
              onClick={onEmptyStart}
            >
              빈 템플릿으로 시작
            </button>
            <button
              type="button"
              className="coverage-simulator-secondary-btn"
              disabled={!name.trim()}
              onClick={() => setStep('copy')}
            >
              기존 시나리오 복사
            </button>
          </div>
        ) : (
          <div className="cs-template-copy-picker">
            <p className="coverage-simulator-page-desc">복사할 원본을 선택하세요.</p>
            <div className="coverage-simulator-scenario-list">
              {systemTemplates.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="coverage-simulator-scenario-card"
                  onClick={() => onPickCopySource(row.id)}
                >
                  <div className="coverage-simulator-scenario-card__title">{row.name}</div>
                  <div className="coverage-simulator-scenario-card__desc">기본 시나리오 · {row.itemCount}개 항목</div>
                </button>
              ))}
              {userSummaries.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="coverage-simulator-scenario-card"
                  onClick={() => onPickCopySource(row.id)}
                >
                  <div className="coverage-simulator-scenario-card__title">{row.name}</div>
                  <div className="coverage-simulator-scenario-card__desc">
                    내 시나리오 · {row.itemCount}개 항목
                  </div>
                </button>
              ))}
            </div>
            <button type="button" className="coverage-simulator-text-btn" onClick={() => setStep('choose')}>
              이전
            </button>
          </div>
        )}
      </main>
    </CoverageSimulatorLayout>
  )
}
