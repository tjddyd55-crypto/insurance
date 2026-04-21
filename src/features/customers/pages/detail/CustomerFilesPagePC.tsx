import StorageWorkspace from '../../../storage/components/StorageWorkspace'

type CustomerFilesPagePCProps = {
  token: string
  customerId: number
}

export default function CustomerFilesPagePC({ token, customerId }: CustomerFilesPagePCProps) {
  return (
    <StorageWorkspace
      token={token}
      customerId={customerId}
      title=""
      subtitle={undefined}
      variant="pc"
    />
  )
}
