# Backend Lip-Sync Integration Guide

**Integration between py-latticework backend and LoomLarge frontend lip-sync system**

---

## Overview

This guide shows how to integrate the Python backend (`py-latticework`) with the frontend lip-sync system for real-time conversational AI with synchronized facial animations.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (LoomLarge)                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Conversation Module                       │  │
│  │  • Text display                                        │  │
│  │  • Emotion state management                            │  │
│  │  • TTS triggering                                      │  │
│  └─────────────────┬──────────────────────────────────────┘  │
│                    │                                          │
│  ┌─────────────────▼──────────────────────────────────────┐  │
│  │            Lip-Sync System                             │  │
│  │  • Phoneme extraction                                  │  │
│  │  • Emotional modulation                                │  │
│  │  • Prosodic gestures                                   │  │
│  │  • Animation scheduling                                │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────┬────────────────────────────────────────┘
                      │ WebSocket/SSE
                      │ (agent messages, emotions)
                      │
┌─────────────────────▼────────────────────────────────────────┐
│               Backend (py-latticework)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          Conversation Manager                          │  │
│  │  • Claude API integration                              │  │
│  │  • Emotion detection from text                         │  │
│  │  • Message streaming                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Event Bus (SSE)                           │  │
│  │  • agent_speaking: { text, emotion }                   │  │
│  │  • agent_emotion_changed: { emotion, intensity }       │  │
│  │  • transcription: { text, isFinal }                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Message Flow

### 1. Agent Speaking Event

**Backend → Frontend:**
```typescript
// SSE event from backend
{
  type: 'agent_speaking',
  data: {
    text: 'Hello! How can I help you today?',
    emotion: 'happy',
    emotionIntensity: 0.7,
    timestamp: 1699999999999
  }
}
```

**Frontend handles:**
```typescript
// In conversation module
conversationService.onAgentSpeaking((event) => {
  const { text, emotion, emotionIntensity } = event.data;

  // 1. Set emotion for modulation
  emotionalModulator.setEmotion(emotion, emotionIntensity);

  // 2. Trigger TTS with lip-sync
  ttsService.speak(text);

  // 3. Update UI
  displayAgentMessage(text);
});
```

### 2. Emotion State Changes

**Backend → Frontend:**
```typescript
{
  type: 'agent_emotion_changed',
  data: {
    emotion: 'surprised',
    intensity: 0.9,
    reason: 'user_question'
  }
}
```

**Frontend updates:**
```typescript
conversationService.onEmotionChanged((event) => {
  const { emotion, intensity } = event.data;

  // Update lip-sync modulation
  emotionalModulator.setEmotion(emotion, intensity);

  // Optionally: blend emotions smoothly
  emotionalModulator.blendEmotions(
    currentEmotion,
    emotion,
    0.5 // 50% blend
  );
});
```

---

## Integration Points

### Frontend: Conversation Service

**File:** `src/services/integratedConversationService.ts`

```typescript
import { emotionalModulator } from '../latticework/lipsync/emotionalModulation';
import { createTTSService } from '../latticework/tts';
import { createLipSyncService } from '../latticework/lipsync';

export function createConversationService(backendUrl: string) {
  const eventSource = new EventSource(`${backendUrl}/api/events/${sessionId}`);
  const ttsService = createTTSService({ engine: 'webSpeech' }, {});
  const lipSyncService = createLipSyncService({}, {});

  // Listen for agent messages
  eventSource.addEventListener('agent_speaking', (event) => {
    const data = JSON.parse(event.data);

    // Set emotion for lip-sync modulation
    if (data.emotion) {
      emotionalModulator.setEmotion(
        data.emotion,
        data.emotionIntensity ?? 0.7
      );
    }

    // Speak with synchronized lip-sync
    ttsService.speak(data.text);
  });

  // Listen for emotion changes
  eventSource.addEventListener('agent_emotion_changed', (event) => {
    const data = JSON.parse(event.data);
    emotionalModulator.setEmotion(data.emotion, data.intensity);
  });

  return {
    sendMessage: async (text: string) => {
      const response = await fetch(`${backendUrl}/api/conversation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      return response.json();
    },
    disconnect: () => {
      eventSource.close();
    },
  };
}
```

### Backend: Emotion Detection

**File:** `py-latticework/app/services/emotion_detector.py`

```python
from anthropic import Anthropic
import re

class EmotionDetector:
    """Detect emotion from agent responses using Claude"""

    def __init__(self, anthropic_client: Anthropic):
        self.client = anthropic_client

    def detect_emotion(self, text: str) -> dict:
        """Detect emotion and intensity from text"""

        # Simple keyword-based detection (can be enhanced with Claude)
        emotion_keywords = {
            'happy': ['happy', 'glad', 'excited', 'great', 'wonderful', '!'],
            'sad': ['sad', 'sorry', 'unfortunately', 'disappointed'],
            'surprised': ['wow', 'oh!', 'really?', 'amazing'],
            'angry': ['angry', 'frustrated', 'annoyed'],
        }

        text_lower = text.lower()
        detected_emotions = {}

        for emotion, keywords in emotion_keywords.items():
            count = sum(1 for kw in keywords if kw in text_lower)
            if count > 0:
                detected_emotions[emotion] = min(1.0, count * 0.3)

        # Get primary emotion
        if detected_emotions:
            primary = max(detected_emotions.items(), key=lambda x: x[1])
            return {
                'emotion': primary[0],
                'intensity': primary[1],
                'confidence': 0.7
            }

        return {
            'emotion': 'neutral',
            'intensity': 0.5,
            'confidence': 0.9
        }
```

### Backend: Event Publishing

**File:** `py-latticework/app/services/conversation.py`

```python
from app.core.events import event_bus
from app.services.emotion_detector import EmotionDetector

class ConversationManager:
    def __init__(self, emotion_detector: EmotionDetector):
        self.emotion_detector = emotion_detector

    async def process_message(self, session_id: str, message: str):
        # Get response from Claude
        response = await self.get_claude_response(message)

        # Detect emotion in response
        emotion_data = self.emotion_detector.detect_emotion(response.text)

        # Publish agent speaking event with emotion
        await event_bus.publish(session_id, {
            'type': 'agent_speaking',
            'data': {
                'text': response.text,
                'emotion': emotion_data['emotion'],
                'emotionIntensity': emotion_data['intensity'],
                'timestamp': time.time() * 1000
            }
        })

        # If emotion changed significantly, publish emotion event
        if self.has_emotion_changed(session_id, emotion_data):
            await event_bus.publish(session_id, {
                'type': 'agent_emotion_changed',
                'data': {
                    'emotion': emotion_data['emotion'],
                    'intensity': emotion_data['intensity'],
                    'reason': 'response_content'
                }
            })
```

---

## Emotion Mapping

Map backend emotion strings to frontend `EmotionType`:

| Backend | Frontend | Modulation Effect |
|---------|----------|-------------------|
| `happy` | `happy` | Wider movements, faster, relaxed |
| `sad` | `sad` | Smaller movements, slower, low energy |
| `excited` | `happy` | Very wide, very fast, high energy |
| `angry` | `angry` | Strong, clipped, precise |
| `surprised` | `surprised` | Exaggerated, mouth open |
| `worried` | `fearful` | Tense, rushed, trembling |
| `neutral` | `neutral` | Balanced, natural |

---

## Testing Integration

### 1. Start Backend
```bash
cd ../py-latticework
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Test Conversation with Emotions

**Send message:**
```bash
curl -X POST http://localhost:8000/api/conversation/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test123", "message": "Tell me something exciting!"}'
```

**Expected SSE events:**
```
event: agent_speaking
data: {"text": "Oh wow! I'd love to share something exciting with you!", "emotion": "excited", "emotionIntensity": 0.8}

event: agent_emotion_changed
data: {"emotion": "happy", "intensity": 0.9}
```

**Frontend should:**
1. Set `emotionalModulator` to `happy` at 0.9 intensity
2. Speak the text with TTS
3. Modulate lip-sync (wider movements, faster timing)
4. Show appropriate facial animation

---

## Performance Considerations

### Latency Budget

| Step | Target | Notes |
|------|--------|-------|
| Backend emotion detection | <50ms | Keyword-based is fast |
| SSE event delivery | <10ms | Local network |
| Frontend emotion update | <5ms | Simple state change |
| TTS start | <100ms | Browser API |
| Lip-sync processing | <50ms | With caching |
| **Total** | **<215ms** | Acceptable for real-time |

### Optimizations

1. **Prefetch Common Responses:** Cache phonemes for common phrases
2. **Emotion Smoothing:** Don't change emotion on every message
3. **Batch Processing:** Process multiple sentences together
4. **Progressive Enhancement:** Start speaking before all processing completes

---

## Example: Full Conversation Flow

```
User types: "What's the weather like today?"
    ↓
Frontend → Backend: POST /api/conversation/message
    ↓
Backend:
  - Calls Claude API
  - Response: "It's a beautiful sunny day! Perfect for outdoor activities!"
  - Detects emotion: happy (0.8 intensity)
  - Publishes SSE event
    ↓
Frontend receives SSE:
  - Sets emotionalModulator.setEmotion('happy', 0.8)
  - Triggers TTS: ttsService.speak(response)
  - TTSSection processes:
    • Extracts phonemes: ['IH', 'T', 'S', ...]
    • Applies emotional modulation (1.4x intensity, 1.6x jaw)
    • Builds animation snippet with prosodic gestures
    • Schedules with priority 50
    ↓
Animation Scheduler:
  - Interpolates at 60fps
  - Applies to ARKit morphs
  - Renders mouth movements
    ↓
User sees: Character speaking with happy, energetic lip-sync
```

---

## Troubleshooting

### Issue: Emotion not changing

**Check:**
1. Backend is sending `emotion` field in events
2. Frontend `emotionalModulator.setEmotion()` is being called
3. Modulation is applied before snippet build (not after)

### Issue: Lip-sync doesn't match emotion

**Check:**
1. Emotion is set BEFORE `ttsService.speak()`
2. `emotionalModulator.getModulators()` returns expected values
3. Modulation is applied in TTSSection curves

### Issue: Delayed emotion changes

**Solutions:**
- Use WebSocket instead of SSE for lower latency
- Prefetch likely emotions
- Smooth transitions with `blendEmotions()`

---

## Next Steps

1. **Implement Emotion Detection:** Use Claude to analyze response sentiment
2. **Add Voice Characteristics:** Different speaking styles per character
3. **Multi-Modal Emotions:** Combine text + audio analysis
4. **Persistent Mood:** Track long-term emotional state
5. **User Emotion Detection:** Analyze user messages to adjust agent behavior

---

**See also:**
- [Backend Project Guide](./BACKEND_PROJECT.md)
- [Complete Lip-Sync Guide](./LIPSYNC_COMPLETE_GUIDE.md)
- [Quick Start Guide](./QUICK_START.md)
