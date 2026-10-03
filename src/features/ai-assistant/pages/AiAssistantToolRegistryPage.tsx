import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { fetchAiToolRegistry } from '../api/aiToolsAdminApi'
import { filterAiTools } from '../aiToolRegistryFilters'
import {
  actionTypeLabel,
  baseFeatureLabel,
  categoryLabel,
  confirmationLabel,
  implementationLabel,
  productionLabel,
  qaLabel,
  STATUS_FILTER_OPTIONS,
  type StatusFilterKey,
} from '../labels'
import type { AiToolDefinition, AiToolRegistryResponse } from '../types'
import '../ai-assistant-tool-registry-table.css'

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="card"
      style={{ padding: '12px 14px', minWidth: 120, flex: '1 1 120px' }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function ToolDetailPanel({
  tool,
  onClose,
}: {
  tool: AiToolDefinition
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-tool-detail-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: 'min(420px, 100%)',
          height: '100%',
          overflowY: 'auto',
          padding: 20,
          borderRadius: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h2 id="ai-tool-detail-title" style={{ margin: 0, fontSize: 18 }}>
            {tool.name}
          </h2>
          <FormButton type="button" variant="secondary" className="button button--secondary" onClick={onClose}>
            닫기
          </FormButton>
        </div>
        <p style={{ color: 'var(--text-sub)', marginTop: 8 }}>{tool.description}</p>
        <dl style={{ margin: '16px 0 0', fontSize: 13, display: 'grid', gap: 10 }}>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Tool Key</dt>
            <dd style={{ margin: '4px 0 0', wordBreak: 'break-all' }}>{tool.key}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Category</dt>
            <dd style={{ margin: '4px 0 0' }}>{categoryLabel(tool.category)}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Action / Risk</dt>
            <dd style={{ margin: '4px 0 0' }}>
              {actionTypeLabel(tool.actionType)} · {tool.riskLevel}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>기존 기능</dt>
            <dd style={{ margin: '4px 0 0' }}>{baseFeatureLabel(tool.baseFeatureStatus)}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Required Permission</dt>
            <dd style={{ margin: '4px 0 0' }}>{tool.requiredPermission ?? '—'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Requires Confirmation</dt>
            <dd style={{ margin: '4px 0 0' }}>{confirmationLabel(tool.requiresConfirmation)}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>AI 연결 / QA / 운영</dt>
            <dd style={{ margin: '4px 0 0' }}>
              {implementationLabel(tool.implementationStatus)} · {qaLabel(tool.qaStatus)} ·{' '}
              {productionLabel(tool.productionEnabled)}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Service Binding</dt>
            <dd style={{ margin: '4px 0 0', wordBreak: 'break-all' }}>{tool.serviceBinding ?? '—'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Version / Updated</dt>
            <dd style={{ margin: '4px 0 0' }}>
              {tool.version} · {tool.updatedAt}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>Phase / Priority</dt>
            <dd style={{ margin: '4px 0 0' }}>
              {tool.phase} / {tool.priority}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-sub)' }}>실행 기록</dt>
            <dd style={{ margin: '4px 0 0', color: 'var(--text-sub)' }}>아직 실행 기록 없음</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default function AiAssistantToolRegistryPage() {
  const { token } = useAuth()
  const [data, setData] = useState<AiToolRegistryResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AiToolDefinition | null>(null)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = await fetchAiToolRegistry(token)
      setData(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTools = useMemo(() => {
    if (!data?.tools) {
      return []
    }
    return filterAiTools(data.tools, {
      status: statusFilter,
      category: categoryFilter,
      search,
    })
  }, [data, statusFilter, categoryFilter, search])

  const summary = data?.summary

  return (
    <main className="page page--with-back">
      <header className="page-header">
        <h1>기능 연결 현황</h1>
        <p style={{ color: 'var(--text-sub)', margin: 0 }}>
          AI 비서 Master Tool Registry (SSOT). 코드 Registry 변경 시 이 화면에 자동 반영됩니다.
        </p>
      </header>

      {error ? <p className="status status--error">{error}</p> : null}

      {summary ? (
        <section style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <SummaryCard label="전체 Tool" value={summary.total} />
            <SummaryCard label="기존 기능 존재" value={summary.baseFeatureExists} />
            <SummaryCard label="AI 미개발" value={summary.aiNotStarted} />
            <SummaryCard label="AI 개발중" value={summary.aiInProgress} />
            <SummaryCard label="AI 연결완료" value={summary.aiConnected} />
            <SummaryCard label="QA 필요" value={summary.qaNeeded} />
            <SummaryCard label="QA PASS" value={summary.qaPass} />
            <SummaryCard label="운영 ON" value={summary.productionOn} />
            <SummaryCard label="QA 실패" value={summary.qaFailed} />
            <SummaryCard label="BLOCKED" value={summary.blocked} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)' }}>
            AI 연결률 {summary.aiConnectionRate.connected} / {summary.aiConnectionRate.total} · 운영 준비율{' '}
            {summary.productionReadyRate.ready} / {summary.productionReadyRate.total}
            {data?.registryVersion ? ` · Registry v${data.registryVersion}` : ''}
          </p>
        </section>
      ) : null}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label className="field" style={{ margin: 0, minWidth: 140 }}>
            <span className="field__label">상태</span>
            <select
              className="field__control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilterKey)}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0, minWidth: 160 }}>
            <span className="field__label">카테고리</span>
            <select
              className="field__control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">전체</option>
              {(data?.categories ?? []).map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <span className="field__label">검색</span>
            <FormInput
              className="field__control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="기능명, Tool Key, 설명, serviceBinding"
            />
          </label>
          <FormButton
            type="button"
            variant="secondary"
            className="button button--secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? '새로고침…' : '새로고침'}
          </FormButton>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="admin-data-table-wrap ai-assistant-tool-registry-table-wrap">
          <table className="admin-data-table ai-assistant-tool-registry-table" style={{ fontSize: 13 }}>
            <colgroup>
              <col className="ai-assistant-tool-registry-table__col--category" />
              <col className="ai-assistant-tool-registry-table__col--name" />
              <col className="ai-assistant-tool-registry-table__col--key" />
              <col className="ai-assistant-tool-registry-table__col--base" />
              <col className="ai-assistant-tool-registry-table__col--action" />
              <col className="ai-assistant-tool-registry-table__col--confirm" />
              <col className="ai-assistant-tool-registry-table__col--impl" />
              <col className="ai-assistant-tool-registry-table__col--qa" />
              <col className="ai-assistant-tool-registry-table__col--prod" />
            </colgroup>
            <thead>
              <tr>
                <th className="ai-assistant-tool-registry-table__cell--wrap" scope="col">영역</th>
                <th className="ai-assistant-tool-registry-table__cell--wrap" scope="col">기능명</th>
                <th className="ai-assistant-tool-registry-table__cell--key" scope="col">Tool Key</th>
                <th className="ai-assistant-tool-registry-table__cell--compact" scope="col">기존 기능</th>
                <th className="ai-assistant-tool-registry-table__cell--compact" scope="col">유형</th>
                <th className="ai-assistant-tool-registry-table__cell--compact" scope="col">확인</th>
                <th className="ai-assistant-tool-registry-table__cell--compact" scope="col">AI 연결</th>
                <th className="ai-assistant-tool-registry-table__cell--compact" scope="col">QA</th>
                <th className="ai-assistant-tool-registry-table__cell--compact" scope="col">운영</th>
              </tr>
            </thead>
            <tbody>
              {filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 20, color: 'var(--text-sub)' }}>
                    {loading ? '불러오는 중…' : '표시할 Tool이 없습니다. 필터를 조정하세요.'}
                  </td>
                </tr>
              ) : (
                filteredTools.map((tool) => (
                  <tr
                    key={tool.key}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(tool)}
                  >
                    <td className="ai-assistant-tool-registry-table__cell--wrap">
                      {categoryLabel(tool.category)}
                    </td>
                    <td className="ai-assistant-tool-registry-table__cell--wrap">{tool.name}</td>
                    <td className="ai-assistant-tool-registry-table__cell--key">{tool.key}</td>
                    <td className="ai-assistant-tool-registry-table__cell--compact">
                      {baseFeatureLabel(tool.baseFeatureStatus)}
                    </td>
                    <td className="ai-assistant-tool-registry-table__cell--compact">
                      {actionTypeLabel(tool.actionType)}
                    </td>
                    <td className="ai-assistant-tool-registry-table__cell--compact">
                      {confirmationLabel(tool.requiresConfirmation)}
                    </td>
                    <td className="ai-assistant-tool-registry-table__cell--compact">
                      {implementationLabel(tool.implementationStatus)}
                    </td>
                    <td className="ai-assistant-tool-registry-table__cell--compact">{qaLabel(tool.qaStatus)}</td>
                    <td className="ai-assistant-tool-registry-table__cell--compact">
                      {productionLabel(tool.productionEnabled)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? <ToolDetailPanel tool={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  )
}
