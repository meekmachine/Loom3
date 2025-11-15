# LoomLarge Architecture Analysis

## Current Services (Latticework)

### 1. **Animation Service** (`latticework/animation`)
- **What it does**: Core animation engine using XState machines
- **Purpose**: Schedules and plays animation snippets with priorities and blending
- **Status**: ✅ Working
- **Used by**: All other services to apply facial animations

### 2. **TTS Service** (`latticework/tts`)
- **What it does**: Text-to-Speech using Web Speech API
- **Purpose**: Converts text to speech with word boundary events
- **Status**: ✅ Working
- **Used by**: AI Chat, French Quiz for speaking

### 3. **Transcription Service** (`latticework/transcription`)
- **What it does**: Speech-to-Text using Web Speech API
- **Purpose**: Listens to user speech and converts to text
- **Status**: ✅ Fixed (added microphone permission request)
- **Used by**: AI Chat, French Quiz for listening

### 4. **LipSync Service** (`latticework/lipsync`)
- **What it does**: Generates viseme timelines from phonemes
- **Purpose**: Syncs lip movements to speech
- **Status**: ✅ Working
- **Used by**: AI Chat, French Quiz for mouth animation

### 5. **Eye/Head Tracking Service** (`latticework/eyeHeadTracking`)
- **What it does**: Coordinates eye and head movements using XState machines
- **Purpose**: Makes character follow gaze targets (mouse, webcam, speakers)
- **Status**: ⚠️ **NEEDS FIX** - Integration broken in AI Chat
- **Used by**: AI Chat, French Quiz
- **Fix needed**: Properly pass `animationManager` in config

### 6. **Conversation Service** (`latticework/conversation`)
- **What it does**: Orchestrates TTS, Transcription, and turn-taking
- **Purpose**: Manages conversation flow between user and AI
- **Status**: ✅ Working
- **Used by**: AI Chat, French Quiz

### 7. **Prosodic Service** (`latticework/prosodic`)
- **What it does**: Adds natural speech gestures (brow raises, head nods)
- **Purpose**: Makes speech more expressive and natural
- **Status**: ⚠️ Partially used (inline in modules)
- **Used by**: Currently embedded in AI Chat module

## Current Modules

### 1. **AI Chat** (`modules/aiChat`)
- **Purpose**: Conversational AI with Claude API
- **Features**:
  - Speech-to-text transcription
  - Claude API integration for responses
  - Text-to-speech with lip-sync
  - Emotional expressions via FACS
  - Eye/head tracking (broken)
  - Webcam tracking (working)
- **Status**: ⚠️ **BROKEN** - File corrupted (lines 227-245)

### 2. **French Quiz** (`modules/frenchQuiz`)
- **Purpose**: Language learning quiz with voice interaction
- **Features**:
  - Voice questions and answers
  - Lip-sync for French pronunciation
  - Eye/head tracking (working)
  - Webcam tracking (working)
- **Status**: ✅ Working

## Old Agencies (Legacy)

Located in `latticework/old_agencies/` - these are the original implementation:
- **Action agencies**: Animation visualizers
- **Cognition agencies**: Conversation, decision making
- **Perception agencies**: Audio transcription, visual processing

**Status**: 📦 Archived - being replaced by new services

## Current Issues

### Critical
1. **AIChatApp.tsx corrupted** (lines 227-245)
   - Leftover code fragments from failed sed commands
   - Eye/head tracking init broken

### Important
2. **Eye/Head tracking not applying gaze** in AI Chat
   - Need to pass `animationManager` in config
   - French Quiz has working example

3. **Hair physics not detecting geometry**
   - Pattern matches `Side_part_wavy`
   - But no bones found (might be mesh-only, no bones)

## What We Want

### Immediate Goals
1. ✅ Fix microphone permission (DONE)
2. ✅ Fix webcam tracking (DONE)
3. ⚠️ Fix eye/head tracking in AI Chat
4. ⚠️ Fix AIChatApp.tsx corruption
5. ⚠️ Test full AI conversation flow

### Future Goals
1. Add more emotional expressions
2. Improve prosodic gestures
3. Add gesture recognition (hand tracking)
4. Add facial expression recognition (webcam)
5. Multi-language support
6. Better hair physics

## Architecture Principles

### Service Layer (Latticework)
- **Pure services**: No React, no UI, just logic
- **Composable**: Services work together via callbacks
- **Testable**: Unit tests for each service
- **Stateful**: Use XState machines for complex state

### Module Layer
- **React components**: UI and user interaction
- **Module lifecycle**: start() / stop() functions
- **Settings**: Configurable via module config
- **Isolated**: Each module is independent

### Integration Pattern
```typescript
// 1. Create services with callbacks
const tts = createTTSService(config, { onStart, onEnd, onBoundary });
const transcription = createTranscriptionService(config, { onTranscript });
const eyeHead = createEyeHeadTrackingService({
  animationManager,  // Key integration point!
  eyeTrackingEnabled: true
});

// 2. Start services
tts.start();
eyeHead.start();

// 3. Connect user input
handleMouseMove = (e) => {
  eyeHead.setGazeTarget({ x, y, z: 0 });
};
```

## Next Steps

1. **Fix AIChatApp.tsx** - Remove lines 227-244, clean up eye/head init
2. **Test AI Chat** - Full conversation flow with gaze tracking
3. **Document patterns** - How to create new modules
4. **Add examples** - Simple module template
