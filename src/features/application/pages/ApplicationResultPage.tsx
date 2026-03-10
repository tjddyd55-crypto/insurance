import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InsuranceResultTemplate } from '../components/InsuranceResultTemplate'
import { buildApplicationTitle } from '../domain/title'
import type { InsuranceApplicationRecord } from '../domain/types'
import { getApplicationById, saveApplication } from '../repository/applicationRepository'
import { exportResultToJpg, exportResultToPdf } from '../services/exportService'
import { shareResult } from '../services/shareService'

export function ApplicationResultPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const resultRef = useRef<HTMLDivElement>(null)
  const [record, setRecord] = useState<InsuranceApplicationRecord | null>(null)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    if (!id) {
      setRecord(null)
      return
    }

    setRecord(getApplicationById(id))
  }, [id])

  if (!record) {
    return (
      <main className="page">
        <header className="page-header">
          <h1>결과문을 찾을 수 없습니다.</h1>
          <p>저장된 신청서에서 다시 불러와 주세요.</p>
        </header>
        <button
          className="button button--primary"
          type="button"
          onClick={() => navigate('/')}
        >
          목록으로 이동
        </button>
      </main>
    )
  }

  const handleSave = () => {
    const saved = saveApplication(record, record.id)
    setRecord(saved)
    setStatusText('신청서를 저장했습니다.')
  }

  const handleExportJpg = async () => {
    if (!resultRef.current) {
      return
    }

    try {
      await exportResultToJpg(resultRef.current, record.title)
      setStatusText('JPG 파일을 생성했습니다.')
    } catch {
      setStatusText('JPG 생성에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  const handleExportPdf = async () => {
    if (!resultRef.current) {
      return
    }

    try {
      await exportResultToPdf(resultRef.current, record.title)
      setStatusText('PDF 파일을 생성했습니다.')
    } catch {
      setStatusText('PDF 생성에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  const handleShare = async () => {
    try {
      const shareMethod = await shareResult(record.id, record.title)
      if (shareMethod === 'kakao') {
        setStatusText('카카오톡 공유 창을 열었습니다.')
        return
      }

      if (shareMethod === 'web-share') {
        setStatusText('기기 공유 시트를 열었습니다.')
        return
      }

      setStatusText('카카오 SDK 미설정으로 링크를 복사했습니다.')
    } catch {
      setStatusText('공유 처리에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  const fileTitle = buildApplicationTitle(record)

  return (
    <main className="page page--result">
      <header className="page-header">
        <h1>신청서 결과문</h1>
        <p>{statusText || '양식 미리보기에서 JPG/PDF/공유를 실행할 수 있습니다.'}</p>
      </header>

      <div className="result-wrapper">
        <div className="result-canvas" ref={resultRef}>
          <InsuranceResultTemplate data={record} />
        </div>
      </div>

      <div className="sticky-actions">
        <button
          className="button"
          type="button"
          onClick={() => navigate(`/applications/${record.id}/edit`)}
        >
          수정하기
        </button>
        <button className="button button--primary" type="button" onClick={handleSave}>
          저장
        </button>
        <button className="button" type="button" onClick={handleExportJpg}>
          JPG 생성
        </button>
        <button className="button" type="button" onClick={handleExportPdf}>
          PDF 생성
        </button>
        <button className="button button--secondary" type="button" onClick={handleShare}>
          카카오톡 공유
        </button>
      </div>

      <p className="result-file-name">내보내기 파일명 기준: {fileTitle}</p>
    </main>
  )
}
