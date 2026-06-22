import ClaimRequestAttachmentActions from './ClaimRequestAttachmentActions'

type ClaimRequestAttachmentBundleActionsProps = {
  fileCount: number
  zipBusy?: boolean
  pdfBusy?: boolean
  onDownloadZip: () => void | Promise<void>
  onDownloadPdf: () => void | Promise<void>
}

/** @deprecated ClaimRequestAttachmentActions(section="bundle") 사용 */
export default function ClaimRequestAttachmentBundleActions({
  fileCount,
  zipBusy = false,
  pdfBusy = false,
  onDownloadZip,
  onDownloadPdf,
}: ClaimRequestAttachmentBundleActionsProps) {
  return (
    <ClaimRequestAttachmentActions
      section="bundle"
      attachmentCount={fileCount}
      onDownloadZip={onDownloadZip}
      onDownloadPdf={onDownloadPdf}
      zipBusy={zipBusy}
      pdfBusy={pdfBusy}
      showCustomerClaimPage={false}
    />
  )
}
