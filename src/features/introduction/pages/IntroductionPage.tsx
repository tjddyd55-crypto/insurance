import { DownloadCards } from '../components/DownloadCards'
import { DownloadFooter } from '../components/DownloadFooter'
import { DownloadHero } from '../components/DownloadHero'
import { ExcelUploadGuide } from '../components/ExcelUploadGuide'
import { InstallGuide } from '../components/InstallGuide'
import { DOWNLOAD_LINKS } from '../constants/downloadLinks'
import { downloadCustomerUploadSampleXlsx } from '../../customers/utils/customerExcelUpload'

export function IntroductionPage() {
  return (
    <main className="intro-page">
      <div className="intro-shell">
        <DownloadHero pcUrl={DOWNLOAD_LINKS.pc} apkUrl={DOWNLOAD_LINKS.apk} />
        <DownloadCards pcUrl={DOWNLOAD_LINKS.pc} apkUrl={DOWNLOAD_LINKS.apk} />
        <InstallGuide />
        <ExcelUploadGuide onDownloadSample={downloadCustomerUploadSampleXlsx} />
        <DownloadFooter />
      </div>
    </main>
  )
}
