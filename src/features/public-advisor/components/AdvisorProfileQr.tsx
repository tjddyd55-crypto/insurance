import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  url: string
  open: boolean
  onClose: () => void
  onView?: () => void
}

export function AdvisorProfileQr({ url, open, onClose, onView }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !url) return
    onView?.()
    const canvas = canvasRef.current
    if (!canvas) return
    void QRCode.toCanvas(canvas, url, { width: 280, margin: 2 }).catch(() => {
      setError('QR을 만들지 못했습니다.')
    })
  }, [open, url, onView])

  if (!open) return null

  const saveImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'onefc-profile-qr.png'
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }

  return (
    <div className="pap-modal-backdrop" role="dialog" aria-modal="true" aria-label="QR 코드">
      <div className="pap-modal pap-modal--qr">
        <h2>내 공개 페이지 QR</h2>
        <p className="pap-affiliation">{url}</p>
        {error ? <p>{error}</p> : <canvas ref={canvasRef} className="pap-qr-canvas" />}
        <div className="pap-cta-row">
          <button type="button" className="pap-btn pap-btn--secondary" onClick={onClose}>닫기</button>
          <button type="button" className="pap-btn pap-btn--primary" onClick={saveImage}>이미지 저장</button>
        </div>
      </div>
    </div>
  )
}
