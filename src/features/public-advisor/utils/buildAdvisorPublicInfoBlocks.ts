import { parseCareerDisplayLines } from './parseCareerDisplayLines'

export type AdvisorPublicInfoBlock =
  | { label: string; value: string; lines?: undefined }
  | { label: string; lines: string[]; value?: undefined }

export function buildAdvisorPublicInfoBlocks(input: {
  gaName?: string | null
  teamName?: string | null
  careerText?: string | null
  officeLine?: string | null
}): AdvisorPublicInfoBlock[] {
  const blocks: AdvisorPublicInfoBlock[] = []
  const affiliation = [input.gaName, input.teamName].filter(Boolean).join(' ')
  if (affiliation) blocks.push({ label: '소속', value: affiliation })
  const careerLines = parseCareerDisplayLines(
    String(input.careerText ?? ''),
    input.gaName ?? null,
    input.teamName ?? null,
  )
  if (careerLines.length === 1) {
    blocks.push({ label: '경력', value: careerLines[0] })
  } else if (careerLines.length > 1) {
    blocks.push({ label: '경력', lines: careerLines })
  }
  const office = String(input.officeLine ?? '').trim()
  if (office) blocks.push({ label: '사무실', value: office })
  return blocks
}
