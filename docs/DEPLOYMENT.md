# Deployment Guide

Complete guide for deploying the LoomLarge backend and frontend.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│              │     │              │     │              │
│   Frontend   │────►│   Backend    │────►│   LiveKit    │
│   (Vercel)   │     │   (Fly.io)   │     │   (Cloud)    │
│              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Prerequisites

1. **LiveKit Account**
   - Sign up at [livekit.io](https://livekit.io)
   - Create a project
   - Get API key, secret, and WebSocket URL

2. **Anthropic API Key**
   - Sign up at [anthropic.com](https://anthropic.com)
   - Get API key from console

3. **Deployment Platforms**
   - Frontend: Vercel, Netlify, or GitHub Pages
   - Backend: Fly.io, Railway, or AWS

## Backend Deployment

### Option 1: Fly.io (Recommended)

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   fly auth login
   ```

3. **Create Fly App**
   ```bash
   cd ../py-latticework
   fly launch
   # Follow prompts, don't deploy yet
   ```

4. **Create Dockerfile**
   ```dockerfile
   FROM python:3.11-slim

   WORKDIR /app

   # Install dependencies
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   # Copy app
   COPY app ./app

   # Expose port
   EXPOSE 8000

   # Run app
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

5. **Set Environment Variables**
   ```bash
   fly secrets set LIVEKIT_URL=wss://your-project.livekit.cloud
   fly secrets set LIVEKIT_API_KEY=your-api-key
   fly secrets set LIVEKIT_API_SECRET=your-api-secret
   fly secrets set ANTHROPIC_API_KEY=your-anthropic-key
   fly secrets set CORS_ORIGINS=https://your-frontend.vercel.app
   ```

6. **Deploy**
   ```bash
   fly deploy
   ```

7. **Get Backend URL**
   ```bash
   fly status
   # URL will be: https://your-app.fly.dev
   ```

### Option 2: Railway

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Create Project**
   ```bash
   cd ../py-latticework
   railway init
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set LIVEKIT_URL=wss://your-project.livekit.cloud
   railway variables set LIVEKIT_API_KEY=your-api-key
   railway variables set LIVEKIT_API_SECRET=your-api-secret
   railway variables set ANTHROPIC_API_KEY=your-anthropic-key
   ```

5. **Deploy**
   ```bash
   railway up
   ```

### Option 3: Docker Compose (Self-Hosted)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ../py-latticework
    ports:
      - "8000:8000"
    environment:
      - LIVEKIT_URL=${LIVEKIT_URL}
      - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
    restart: unless-stopped
```

Deploy:
```bash
docker-compose up -d
```

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Set Environment Variable**
   Create `.env.production`:
   ```bash
   VITE_BACKEND_URL=https://your-backend.fly.dev
   ```

   Or set in Vercel dashboard:
   ```bash
   vercel env add VITE_BACKEND_URL
   ```

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login**
   ```bash
   netlify login
   ```

3. **Create `netlify.toml`**
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [build.environment]
     VITE_BACKEND_URL = "https://your-backend.fly.dev"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

4. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Option 3: GitHub Pages

1. **Update `package.json`**
   ```json
   {
     "homepage": "https://yourusername.github.io/LoomLarge"
   }
   ```

2. **Create `.env.production`**
   ```bash
   VITE_BACKEND_URL=https://your-backend.fly.dev
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

## LiveKit Setup

### Option 1: LiveKit Cloud (Recommended)

1. Go to [livekit.io/cloud](https://livekit.io/cloud)
2. Create a project
3. Get credentials:
   - API Key
   - API Secret
   - WebSocket URL (wss://your-project.livekit.cloud)

### Option 2: Self-Hosted LiveKit

1. **Using Docker**
   ```bash
   docker run -d \
     --name livekit \
     -p 7880:7880 \
     -p 7881:7881 \
     -p 7882:7882/udp \
     -v $PWD/livekit.yaml:/livekit.yaml \
     livekit/livekit-server \
     --config /livekit.yaml
   ```

2. **Create `livekit.yaml`**
   ```yaml
   port: 7880
   rtc:
     port_range_start: 50000
     port_range_end: 60000
     use_external_ip: true
   keys:
     your-api-key: your-api-secret
   ```

## Environment Variables Summary

### Backend
```bash
# Required
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
ANTHROPIC_API_KEY=your-anthropic-key

# Optional
DEBUG=False
LOG_LEVEL=INFO
CORS_ORIGINS=https://your-frontend.vercel.app
HOST=0.0.0.0
PORT=8000
SESSION_TIMEOUT=3600
MAX_SESSIONS=100
```

### Frontend
```bash
VITE_BACKEND_URL=https://your-backend.fly.dev
```

## Post-Deployment

### 1. Test Backend Health
```bash
curl https://your-backend.fly.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "livekit_configured": true,
  "mcp_enabled": true
}
```

### 2. Test SSE Connection
```javascript
const eventSource = new EventSource('https://your-backend.fly.dev/api/events/test');
eventSource.onmessage = (e) => console.log(e.data);
```

### 3. Test Frontend
1. Open your frontend URL
2. Start a conversation
3. Check browser console for connection logs
4. Verify LiveKit audio works

## Monitoring

### Backend Logs

**Fly.io:**
```bash
fly logs
```

**Railway:**
```bash
railway logs
```

### Frontend Logs

**Vercel:**
```bash
vercel logs
```

**Netlify:**
Check dashboard at app.netlify.com

### LiveKit Monitoring

LiveKit Cloud dashboard shows:
- Active rooms
- Participant count
- Bandwidth usage
- Error rates

## Scaling

### Backend Scaling

**Fly.io:**
```bash
# Scale to 2 instances
fly scale count 2

# Scale VM size
fly scale vm shared-cpu-2x
```

**Railway:**
- Auto-scales based on load
- Configure in dashboard

### LiveKit Scaling

LiveKit Cloud automatically scales based on usage.

For self-hosted, use Kubernetes or multiple instances with load balancer.

## Troubleshooting

### CORS Errors
- Check `CORS_ORIGINS` in backend matches frontend URL
- Include protocol (https://)
- Don't include trailing slash

### LiveKit Connection Failed
- Verify LiveKit credentials
- Check firewall allows WebRTC ports
- Ensure token generation works

### SSE Not Receiving Events
- Check session_id is valid
- Verify backend is publishing events
- Check browser console for errors

### 502 Bad Gateway
- Backend not running
- Check backend logs
- Verify port configuration

## Security Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Rotate API keys regularly
- [ ] Set secure CORS origins
- [ ] Enable rate limiting
- [ ] Monitor error logs
- [ ] Use environment variables for secrets
- [ ] Enable authentication (if needed)
- [ ] Keep dependencies updated

## Cost Estimates

### LiveKit Cloud
- Free tier: 50 GB/month
- Pay-as-you-go: ~$0.02/GB

### Backend (Fly.io)
- Free tier: 3 shared VMs
- Paid: $1.94/month per VM

### Frontend (Vercel)
- Free tier: 100 GB bandwidth
- Paid: $20/month (Pro)

### Total for Small Project
- ~$0-20/month depending on usage
