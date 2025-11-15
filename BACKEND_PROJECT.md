# py-latticework Backend Integration

Modern Python backend with LiveKit integration, MCP compliance, and Server-Sent Events for the LoomLarge conversational AI platform.

**Location:** This backend lives in a separate project at `/Users/jonathan/Novembre/py-latticework/`

## Projects

- **LoomLarge**: Frontend (React/TypeScript) - This directory
- **py-latticework**: Backend (Python/FastAPI) - `../py-latticework/`

## Overview

This project adds a production-ready Python backend to LoomLarge with the following features:

### Key Features

1. **LiveKit Integration** - Real-time audio/video streaming for conversational AI
2. **MCP Compliance** - Full Model Context Protocol support (server + client)
3. **Server-Sent Events (SSE)** - Modern push notifications (superior to WebSockets for unidirectional streaming)
4. **FastAPI Backend** - High-performance async Python web framework
5. **Type Safety** - Full Pydantic models and Python type hints
6. **Production Ready** - Docker support, health checks, monitoring

## Technology Stack

### Backend
- **FastAPI** - Modern async web framework
- **LiveKit** - Real-time WebRTC communication
- **MCP SDK** - Model Context Protocol for AI integration
- **SSE (Server-Sent Events)** - Push notifications to clients
- **Pydantic** - Data validation and settings management
- **Uvicorn** - ASGI server

### Frontend Integration
- **LiveKit Client** - Browser WebRTC client
- **EventSource API** - Native SSE support
- **TypeScript Services** - Type-safe API integration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  Conversation  │  │   LiveKit      │  │   MCP Client     │  │
│  │    Service     │  │   Service      │  │   Service        │  │
│  └────────┬───────┘  └───────┬────────┘  └────────┬─────────┘  │
└───────────┼──────────────────┼──────────────────────┼──────────┘
            │                  │                      │
            │ SSE Events       │ WebRTC Audio         │ MCP Tools
            │ HTTP REST        │                      │
            ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   Event    │  │   LiveKit    │  │      MCP Server         │ │
│  │    Bus     │  │   Service    │  │  (Tools for AI agents)  │ │
│  └─────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
│        │                │                       │               │
│  ┌─────▼────────────────▼───────────────────────▼─────────────┐ │
│  │            Conversation Manager                             │ │
│  │  • Session management                                       │ │
│  │  • AI response generation (via Anthropic MCP Client)       │ │
│  │  • Event publishing                                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │                  │
            │                  │
            ▼                  ▼
    ┌──────────────┐   ┌──────────────┐
    │  Anthropic   │   │   LiveKit    │
    │     API      │   │    Cloud     │
    └──────────────┘   └──────────────┘
```

## Project Structure

```
py-latticework/                     # Python backend (separate project)
│   ├── app/
│   │   ├── main.py                # FastAPI app entry point
│   │   ├── config.py              # Configuration management
│   │   ├── api/                   # API endpoints
│   │   │   ├── conversation.py    # Conversation endpoints
│   │   │   ├── livekit.py         # LiveKit endpoints
│   │   │   └── sse.py             # SSE streaming endpoint
│   │   ├── core/                  # Core functionality
│   │   │   └── events.py          # Event bus for SSE
│   │   ├── services/              # Business logic
│   │   │   ├── conversation.py    # Conversation manager
│   │   │   └── livekit_service.py # LiveKit integration
│   │   ├── mcp/                   # MCP implementation
│   │   │   ├── server.py          # MCP server (tools)
│   │   │   └── client.py          # MCP client (Anthropic)
│   │   └── models/                # Pydantic models
│   │       ├── conversation.py
│   │       └── events.py
│   ├── requirements.txt           # Python dependencies
│   ├── Dockerfile                 # Docker image
│   └── README.md                  # Backend docs

LoomLarge/                          # Frontend project
├── src/                           # Frontend source
│   └── services/                  # New integration services
│       ├── backendService.ts      # Backend HTTP + SSE client
│       ├── livekitService.ts      # LiveKit WebRTC client
│       ├── mcpService.ts          # MCP client
│       └── integratedConversationService.ts  # Unified service
├── docs/                          # Documentation
│   ├── QUICK_START.md            # 5-minute setup guide
│   ├── BACKEND_INTEGRATION.md    # Integration guide
│   └── DEPLOYMENT.md             # Deployment guide
└── package.json                   # Updated with livekit-client
```

## Quick Start

### 1. Backend Setup
```bash
cd ../py-latticework
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn app.main:app --reload
```

### 2. Frontend Setup
```bash
npm install
echo "VITE_BACKEND_URL=http://localhost:8000" > .env.local
npm run dev
```

### 3. Test
Open `http://localhost:8000/docs` for API docs
Open `http://localhost:5173` for frontend

## Key Concepts

### Server-Sent Events (SSE)

SSE provides unidirectional server-to-client streaming, perfect for conversation events:

**Why SSE over WebSockets?**
- Simpler protocol (HTTP-based)
- Native browser reconnection
- Better for one-way streaming
- Lower overhead
- Works with HTTP/2 multiplexing

**Event Flow:**
```
Client connects → Backend publishes events → Client receives in real-time
```

### LiveKit Integration

LiveKit handles real-time audio/video:

**Flow:**
1. Client requests token from backend
2. Backend generates JWT with room permissions
3. Client connects to LiveKit with token
4. Audio streams through WebRTC
5. Backend processes audio for transcription/TTS

### MCP (Model Context Protocol)

**Two implementations:**

1. **MCP Server** (backend exposes tools to AI agents)
   - External AI agents can control conversations
   - Tools: start_conversation, send_message, etc.

2. **MCP Client** (backend calls Anthropic API)
   - Backend uses Claude for response generation
   - Supports tool use and function calling

## API Endpoints

### Conversation
- `POST /api/conversation/start` - Start session
- `POST /api/conversation/message` - Send message
- `GET /api/conversation/session/{id}` - Get session info
- `DELETE /api/conversation/session/{id}` - Stop session
- `GET /api/conversation/sessions` - List all sessions

### LiveKit
- `POST /api/livekit/token` - Generate access token
- `POST /api/livekit/room` - Create room
- `GET /api/livekit/rooms` - List rooms
- `GET /api/livekit/room/{name}` - Get room info
- `DELETE /api/livekit/room/{name}` - Delete room

### Server-Sent Events
- `GET /api/events/{session_id}` - Stream conversation events

### System
- `GET /` - API info
- `GET /health` - Health check
- `GET /docs` - Swagger UI

## Usage Example

```typescript
import { createIntegratedConversationService } from './services/integratedConversationService';

const conversation = createIntegratedConversationService(
  { backendUrl: 'http://localhost:8000' },
  {
    onAgentSpeaking: (text) => console.log('Agent:', text),
    onTranscription: (text, isFinal) => console.log('User:', text),
    onStateChange: (state) => console.log('State:', state),
  }
);

await conversation.start('You are a helpful assistant');
await conversation.sendMessage('Hello!');
await conversation.stop();
```

## Deployment

### Backend: Fly.io
```bash
fly launch
fly secrets set LIVEKIT_URL=... LIVEKIT_API_KEY=...
fly deploy
```

### Frontend: Vercel
```bash
vercel env add VITE_BACKEND_URL
vercel --prod
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for details.

## Environment Variables

### Backend (.env)
```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
ANTHROPIC_API_KEY=your-anthropic-key
CORS_ORIGINS=http://localhost:5173
```

### Frontend (.env.local)
```bash
VITE_BACKEND_URL=http://localhost:8000
```

## Documentation

- **[Quick Start Guide](./docs/QUICK_START.md)** - Get running in 5 minutes
- **[Backend Integration](./docs/BACKEND_INTEGRATION.md)** - Detailed integration guide
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment
- **[Backend README](./backend/README.md)** - Backend-specific docs

## Features Comparison

| Feature | Before | After |
|---------|--------|-------|
| Backend | Client-side only | FastAPI server |
| Audio/Video | Browser only | LiveKit WebRTC |
| Push Notifications | Polling | Server-Sent Events |
| AI Integration | Direct API calls | MCP-compliant |
| Scalability | Limited | Horizontally scalable |
| Production Ready | No | Yes (Docker, health checks) |

## Development

### Run Tests
```bash
cd backend
pytest
```

### Type Checking
```bash
mypy app/
```

### Code Quality
```bash
black app/
ruff check app/
```

## Contributing

1. Backend changes: `backend/app/`
2. Frontend services: `src/services/`
3. Documentation: `docs/`
4. Tests: `backend/tests/`

## License

MIT

## Next Steps

1. Read [Quick Start Guide](./docs/QUICK_START.md)
2. Set up LiveKit account
3. Get Anthropic API key
4. Deploy to production
5. Build your conversational AI!
