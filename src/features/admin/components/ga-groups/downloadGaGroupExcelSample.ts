import * as XLSX from 'xlsx'

/** GA 그룹 엑셀 대량 등록 양식 샘플 (지점명 · GA 코드) */
export function downloadGaGroupExcelSample() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['지점명', 'GA 코드'],
    ['서울중앙지점', ''],
    ['해상지점', ''],
    ['부산지점', ''],
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '지점')
  XLSX.writeFile(book, 'ga-group-branches-sample.xlsx')
}
