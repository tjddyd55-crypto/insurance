import type { AccountVaultAdapter } from '../api/accountVaultAdapter'

export type SharedAccountVaultDetailViewProps = {
  adapter: AccountVaultAdapter | null
  ownerName: string
  metaLoading: boolean
  accessError: string
}
