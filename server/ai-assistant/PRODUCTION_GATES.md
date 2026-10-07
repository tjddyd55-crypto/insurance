# AI Assistant — Production Gates (Development note)

## In-memory sessions (NOT production-ready)

- **Customer Import Session** (`server/ai-assistant/customer-import/sessionStore.js`)
- **AI Conversation** (`server/ai-assistant/conversation/conversationStore.js`)
- **Pending import commit** (`server/ai-assistant/confirmation/confirmationService.js`)
- **Import analysis job** (`server/ai-assistant/customer-import/importAnalysisJobStore.js`) — unstructured semantic + preview pipeline progress (in-memory, DEV single replica)

These stores are process-local `Map` instances with TTL. They are acceptable on Railway **Development** when the app runs as a **single replica**.

Before Production enablement (`productionEnabled` on tools, OpenAI on Production):

1. Deploy **shared persistent session** (Postgres and/or Redis) for import + conversation + confirmation.
2. Verify horizontal scaling and rolling deploys do not orphan in-flight imports.
3. Keep `productionEnabled: false` on AI import tools until the above is complete.

OpenAI Production keys and models remain off until a separate Production OpenAI project is provisioned.
