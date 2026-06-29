import { copyTextToClipboard } from '../../../lib/clipboard'

export async function copyToClipboard(text: string): Promise<boolean> {
  return copyTextToClipboard(text)
}
