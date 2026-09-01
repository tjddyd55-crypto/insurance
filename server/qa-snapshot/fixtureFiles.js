import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { consentPutObject } from '../lib/consentStorage.js'
import { joinR2Key } from '../lib/r2KeyPolicy.js'

const SAFE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function createSafePdf() {
  const document = await PDFDocument.create()
  document.setTitle('ONE FC QA representative document')
  document.setAuthor('ONE FC QA')
  const page = document.addPage([595, 842])
  const font = await document.embedFont(StandardFonts.Helvetica)
  page.drawText('ONE FC QA - Sanitized representative document', {
    x: 48,
    y: 770,
    size: 16,
    font,
    color: rgb(0, 0.24, 0.12),
  })
  page.drawText('This file contains no production customer data.', {
    x: 48,
    y: 740,
    size: 11,
    font,
  })
  return Buffer.from(await document.save())
}

export async function ensureQaFixtureFiles(objectRoot) {
  const pdfKey = joinR2Key(objectRoot, 'qa-snapshot', 'fixtures', 'representative.pdf')
  const pngKey = joinR2Key(objectRoot, 'qa-snapshot', 'fixtures', 'representative.png')
  const pdf = await createSafePdf()
  await consentPutObject(pdfKey, pdf, 'application/pdf')
  await consentPutObject(pngKey, SAFE_PNG, 'image/png')
  return {
    pdf: { key: pdfKey, size: pdf.length, mimeType: 'application/pdf' },
    png: { key: pngKey, size: SAFE_PNG.length, mimeType: 'image/png' },
  }
}
