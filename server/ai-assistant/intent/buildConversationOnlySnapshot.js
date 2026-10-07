/**
 * Intent snapshot when there is no active import session loaded.
 * @param {{ conversation: object }} params
 */
export function buildConversationOnlySnapshot({ conversation }) {
  const importSessionId = conversation.importSessionId ?? null
  return {
    currentScreen: conversation.pageContext?.currentRoute ?? null,
    conversationId: conversation.conversationId,
    attachments: [],
    customerImport: {
      importSessionId,
      sourceMode: null,
      analysisJobId: null,
      analysisStatus: null,
      analysisRunning: false,
      previewExists: false,
      previewVersionHash: null,
      plannedCreate: null,
      confirmationExists: Boolean(conversation.pendingAction?.confirmationId),
      committed: false,
    },
    flags: {
      attachmentExists: Boolean(importSessionId),
      previewExists: false,
      analysisRunning: false,
    },
    resolvedEntities: conversation.resolvedEntities ?? null,
    pendingClarification: conversation.pendingClarification ?? null,
    lastReadContext: conversation.lastReadContext ?? null,
  }
}
