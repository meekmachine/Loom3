# Conversation Agency - Animation Coordination Example

## Testing Eye/Head Tracking + Prosodic Gestures

This document shows how to set up and test the smooth coordination between eye/head tracking and prosodic expression agencies through the conversation service.

## Problem Being Solved

When multiple agencies control the same AUs (Action Units), we need smooth transitions:
- **Eye/Head Tracking** controls head AUs (51, 52, 53, 54) for gaze direction
- **Prosodic Gestures** control head AUs (53, 54) for nods and speech-synchronized movements

Without animation continuity, head movements would snap/jitter when switching between agencies. With continuity, transitions are smooth and natural.

## Setup Code

```typescript
import { createAnimationService } from '@/latticework/animation';
import { createEyeHeadTrackingService } from '@/latticework/eyeHeadTracking';
import { createProsodicService } from '@/latticework/prosodic';
import { createTTSService } from '@/latticework/tts';
import { createTranscriptionService } from '@/latticework/transcription';
import { createConversationService } from '@/latticework/conversation';
import { EngineThree } from '@/engine/EngineThree';

// 1. Create engine and animation agency (central coordinator)
const engine = new EngineThree();
const animationAgency = createAnimationService(engine);

console.log('[Setup] Animation agency created with getCurrentValue() support');

// 2. Create Eye/Head Tracking agency
const eyeHeadTracking = createEyeHeadTrackingService({
  eyeTrackingEnabled: true,
  headTrackingEnabled: true,
  headFollowEyes: true,
  eyePriority: 20,    // High priority
  headPriority: 20,   // High priority
  animationAgency,    // Uses animation agency for scheduling
});

eyeHeadTracking.start();
console.log('[Setup] Eye/head tracking started (priority 20)');

// 3. Create Prosodic Expression agency
const prosodicService = createProsodicService(
  {
    browPriority: 30,   // Higher priority for brow
    headPriority: 30,   // Higher priority for head gestures
    fadeSteps: 4,
    fadeStepInterval: 120,
  },
  {
    onBrowStart: () => console.log('[Prosodic] Brow gesture started'),
    onHeadStart: () => console.log('[Prosodic] Head gesture started'),
    onPulse: (channel, wordIndex) => console.log(`[Prosodic] Pulse ${channel} @word ${wordIndex}`),
  },
  {
    scheduleSnippet: (snippet) => {
      console.log('[Prosodic] Scheduling snippet:', snippet.name);
      return animationAgency.schedule(snippet);
    },
    removeSnippet: (name) => animationAgency.remove(name),
    getCurrentValue: (auId) => {
      const value = animationAgency.getCurrentValue(auId);
      console.log(`[Prosodic] getCurrentValue(${auId}) = ${value.toFixed(3)}`);
      return value;
    },
  }
);

console.log('[Setup] Prosodic agency created (priority 30 for head)');

// 4. Create TTS service
const ttsService = createTTSService({
  engine: 'webSpeech',
  rate: 1.0,
});

console.log('[Setup] TTS service created');

// 5. Create Transcription service (if needed)
const transcriptionService = createTranscriptionService({
  language: 'en-US',
});

console.log('[Setup] Transcription service created');

// 6. Create Conversation service (coordinates all agencies)
const conversationService = createConversationService(
  ttsService,
  transcriptionService,
  {
    autoListen: true,
    detectInterruptions: true,
    eyeHeadTracking,      // Manages gaze during speech
    prosodicService,      // Adds prosodic gestures during speech
  },
  {
    onStateChange: (state) => console.log(`[Conversation] State: ${state}`),
    onAgentUtterance: (text) => console.log(`[Conversation] Agent: "${text}"`),
    onUserSpeech: (text, isFinal) => console.log(`[Conversation] User: "${text}" (final: ${isFinal})`),
  }
);

console.log('[Setup] Conversation service created');
```

## Conversation Flow Generator

```typescript
function* simpleConversationFlow(): ConversationFlow {
  // Initial greeting
  yield 'Hello! How are you doing today?';

  // Wait for user response
  const userResponse1 = yield;
  console.log('[Flow] User said:', userResponse1);

  // Respond based on user input
  if (userResponse1.toLowerCase().includes('good') || userResponse1.toLowerCase().includes('great')) {
    yield "That's wonderful to hear! I'm glad you're having a good day.";
  } else if (userResponse1.toLowerCase().includes('bad') || userResponse1.toLowerCase().includes('not')) {
    yield "I'm sorry to hear that. Is there anything I can help you with?";
  } else {
    yield "I see. Tell me more about that.";
  }

  // Continue conversation
  const userResponse2 = yield;
  console.log('[Flow] User said:', userResponse2);

  // Final response
  yield "Thank you for chatting with me! It's been a pleasure talking with you.";

  // End conversation
  return;
}
```

## Start Conversation

```typescript
// Start the conversation
conversationService.start(simpleConversationFlow);

console.log('[Test] Conversation started!');
console.log('[Test] Watch the console and observe:');
console.log('  1. Eye/head tracking sets initial gaze (priority 20)');
console.log('  2. Prosodic gestures start when speaking (priority 30)');
console.log('  3. getCurrentValue() queries show smooth continuity');
console.log('  4. Head nods overlay on top of gaze direction');
console.log('  5. Smooth transitions when gestures end');
```

## Expected Console Output

```
[Setup] Animation agency created with getCurrentValue() support
[Setup] Eye/head tracking started (priority 20)
[Setup] Prosodic agency created (priority 30 for head)
[Setup] TTS service created
[Setup] Transcription service created
[Setup] Conversation service created

[Test] Conversation started!

[Conversation] State: idle
[Flow] Starting flow
[Conversation] State: agentSpeaking
[Conversation] Agent: "Hello! How are you doing today?"

[ConversationService] Prosodic gestures started
[Prosodic] Brow gesture started
[Prosodic] Head gesture started

[Prosodic] getCurrentValue(33) = 0.000  // Initial query
[Prosodic] Scheduling snippet: prosodic:nod_1234567890
[Prosodic] Pulse head @word 0

[Prosodic] getCurrentValue(33) = 0.350  // Mid-speech query
[Prosodic] Scheduling snippet: prosodic:nod_1234567891
[Prosodic] Pulse head @word 3

[ConversationService] Prosodic gestures stopping (fade-out)
[Conversation] State: userSpeaking

... (user speaks) ...

[Conversation] User: "I'm doing great!" (final: true)
[Flow] User said: I'm doing great!
[Conversation] State: processing
[Conversation] State: agentSpeaking
[Conversation] Agent: "That's wonderful to hear! I'm glad you're having a good day."

[ConversationService] Prosodic gestures started
[Prosodic] getCurrentValue(33) = 0.000  // Smoothly returned to neutral
[Prosodic] Scheduling snippet: prosodic:nod_1234567892
...
```

## What to Observe

### 1. Priority-Based Blending
- **Eye/head tracking** (priority 20) sets initial gaze
- **Prosodic gestures** (priority 30) win when they trigger
- Head smoothly transitions between agencies

### 2. Animation Continuity
- `getCurrentValue()` calls show head position BEFORE scheduling
- New snippets start from current value, NOT from 0
- No visual snapping when prosodic gestures trigger

### 3. Smooth Coordination
- **During speech**:
  - Eye/head tracking maintains base gaze direction
  - Prosodic head nods overlay on top of gaze
  - Head moves naturally (e.g., looking left + nodding)
- **After speech**:
  - Prosodic gestures fade out gradually
  - Eye/head tracking smoothly resumes control
  - Head returns to gaze target position

## Testing Different Scenarios

### Scenario 1: Looking Left + Head Nod
```typescript
// Manually set gaze left
eyeHeadTracking.setMode('manual');
eyeHeadTracking.setGazeTarget({ x: -0.5, y: 0, z: 0 });

// Wait for head to reach target
setTimeout(() => {
  // Start speaking (triggers prosodic nod)
  conversationService.submitUserInput('Hello');
}, 1000);

// Expected: Head nods FROM left position, not from center
```

### Scenario 2: Mouse Tracking + Speech
```typescript
// Enable mouse tracking
eyeHeadTracking.setMode('mouse');

// Start conversation
conversationService.start(simpleConversationFlow);

// Move mouse around WHILE agent is speaking
// Expected: Head follows mouse + prosodic nods blend smoothly
```

### Scenario 3: Rapid Gaze Changes + Speech
```typescript
// Set up interval to change gaze during speech
let gazeInterval;

const callbacks = {
  onAgentUtterance: () => {
    // Change gaze every 500ms during speech
    gazeInterval = setInterval(() => {
      const randomGaze = {
        x: (Math.random() - 0.5) * 0.6,
        y: (Math.random() - 0.5) * 0.4,
      };
      eyeHeadTracking.setGazeTarget(randomGaze);
    }, 500);
  },
  onStateChange: (state) => {
    if (state !== 'agentSpeaking' && gazeInterval) {
      clearInterval(gazeInterval);
    }
  },
};

// Expected: Head smoothly interpolates between targets
// Prosodic nods overlay without fighting
```

## Debugging

### Check Current Values
```typescript
// Add to console
setInterval(() => {
  console.log('Current head pitch up:', animationAgency.getCurrentValue('53'));
  console.log('Current head pitch down:', animationAgency.getCurrentValue('54'));
  console.log('Current head yaw left:', animationAgency.getCurrentValue('51'));
  console.log('Current head yaw right:', animationAgency.getCurrentValue('52'));
}, 1000);
```

### Visualize Priority Conflicts
```typescript
// Enable debug mode in animation scheduler
animationAgency.debug();

// Shows which snippets are active and their priorities
```

## Success Criteria

✅ **No visual snapping** - Head moves smoothly at all times
✅ **Prosodic nods overlay** - Head nods FROM current gaze position
✅ **Priority blending works** - Prosodic (30) wins over gaze (20)
✅ **Smooth transitions** - When prosodic ends, head returns to gaze smoothly
✅ **Console shows getCurrentValue()** - Values are queried before scheduling

## Troubleshooting

### Problem: Head snaps when prosodic nod triggers
**Solution**: Check that prosodic scheduler is using `getCurrentValue()`:
```typescript
const currentHeadPitchUp = this.host.getCurrentValue?.('53') ?? 0;
// Start curve from currentHeadPitchUp, NOT from 0
```

### Problem: Prosodic gestures don't show
**Solution**: Check priority - prosodic should be higher than eye/head:
```typescript
prosodicService: { headPriority: 30 }  // Higher than eye/head (20)
```

### Problem: getCurrentValue() returns 0
**Solution**: Ensure animation agency is playing:
```typescript
animationAgency.play();  // Must be playing to track values
```

## Next Steps

After confirming smooth coordination:
1. Update prosodic scheduler to use `getCurrentValue()`
2. Update eye/head scheduler to use `getCurrentValue()`
3. Add integration tests
4. Document in main README
