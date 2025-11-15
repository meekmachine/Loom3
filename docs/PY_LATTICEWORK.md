# py-latticework Backend

This document explains the relationship between LoomLarge (frontend) and py-latticework (backend).

## Project Structure

```
/Users/jonathan/Novembre/
├── LoomLarge/              # Frontend (React/TypeScript)
│   ├── src/
│   │   ├── services/       # Backend integration services
│   │   └── components/     # React components
│   └── docs/              # Documentation
│
└── py-latticework/         # Backend (Python/FastAPI)
    ├── app/               # Backend application
    │   ├── api/          # REST endpoints + SSE
    │   ├── services/     # Business logic
    │   ├── mcp/          # MCP server & client
    │   └── models/       # Pydantic models
    └── tests/            # Tests
```

## Why Separate Projects?

1. **Different Technologies**: Python backend, TypeScript frontend
2. **Independent Scaling**: Deploy and scale separately
3. **Team Separation**: Frontend and backend teams can work independently
4. **Reusability**: Backend can serve multiple frontends
5. **Clear Boundaries**: API contract is the interface

## Communication

The projects communicate via:

1. **HTTP REST API** - Request/response for actions
2. **Server-Sent Events (SSE)** - Real-time event streaming
3. **LiveKit WebRTC** - Audio/video streams

## Quick Start

### Terminal 1: Backend
```bash
cd ../py-latticework
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with credentials
uvicorn app.main:app --reload
```

### Terminal 2: Frontend
```bash
cd ../LoomLarge
npm install
echo "VITE_BACKEND_URL=http://localhost:8000" > .env.local
npm run dev
```

## Frontend Services

The frontend has TypeScript services that integrate with py-latticework:

- [backendService.ts](../src/services/backendService.ts) - HTTP + SSE client
- [livekitService.ts](../src/services/livekitService.ts) - LiveKit WebRTC
- [mcpService.ts](../src/services/mcpService.ts) - MCP client
- [integratedConversationService.ts](../src/services/integratedConversationService.ts) - Unified API

## Usage Example

```typescript
import { createIntegratedConversationService } from './services/integratedConversationService';

const conversation = createIntegratedConversationService(
  { backendUrl: 'http://localhost:8000' },
  {
    onAgentSpeaking: (text) => console.log('Agent:', text),
    onTranscription: (text, isFinal) => console.log('User:', text),
  }
);

await conversation.start();
await conversation.sendMessage('Hello!');
```

## Development Workflow

1. **Backend Changes**: Edit files in `../py-latticework/app/`
2. **Frontend Integration**: Update services in `src/services/`
3. **Testing**: Both projects run simultaneously during development

## Backend API

When backend is running, visit:
- `http://localhost:8000/docs` - Swagger UI (interactive API docs)
- `http://localhost:8000/health` - Health check

## Environment Variables

### Backend (.env in py-latticework)
```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
ANTHROPIC_API_KEY=your-anthropic-key
CORS_ORIGINS=http://localhost:5173
```

### Frontend (.env.local in LoomLarge)
```bash
VITE_BACKEND_URL=http://localhost:8000
```

## Deployment

Both projects deploy separately:

**Backend (py-latticework):**
- Fly.io, Railway, or Docker
- See `../py-latticework/README.md`

**Frontend (LoomLarge):**
- Vercel, Netlify, or GitHub Pages
- Update `VITE_BACKEND_URL` to production backend URL

## Documentation

- **Backend Docs**: `../py-latticework/README.md`
- **Quick Start**: [QUICK_START.md](./QUICK_START.md)
- **Integration Guide**: [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Project Overview**: [BACKEND_PROJECT.md](../BACKEND_PROJECT.md)

## Next Steps

1. Read [QUICK_START.md](./QUICK_START.md) for setup
2. Explore backend at `../py-latticework/`
3. Check out example: [BackendConversationExample.tsx](../src/examples/BackendConversationExample.tsx)
4. Deploy both projects to production
