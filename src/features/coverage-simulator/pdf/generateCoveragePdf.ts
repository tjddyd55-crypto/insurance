import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function downloadCoveragePdfFromPrintRoot(root: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: root.offsetWidth,
    windowWidth: root.offsetWidth,
  })
  const imageData = canvas.toDataURL('image/jpeg', 0.98)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imageWidth = pageWidth
  const imageHeight = (canvas.height * imageWidth) / canvas.width

  let heightLeft = imageHeight
  let position = 0

  pdf.addImage(imageData, 'JPEG', 0, position, imageWidth, imageHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imageHeight
    pdf.addPage()
    pdf.addImage(imageData, 'JPEG', 0, position, imageWidth, imageHeight)
    heightLeft -= pageHeight
  }

  pdf.save(fileName)
}

export function printCoverageDocument(): void {
  window.print()
}
