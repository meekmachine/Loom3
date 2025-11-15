# AI Chat Module

A conversational AI module powered by Anthropic's Claude API with emotional facial expressions using FACS (Facial Action Coding System).

## Features

- **Voice Conversation**: Speak naturally with Claude using voice input/output
- **Emotional Expressions**: AI responses include emotional facial expressions through FACS-encoded Action Units (AUs)
- **Lip Sync**: Natural lip synchronization during speech
- **Prosodic Gestures**: Head movements and brow raises for natural communication
- **Continuous Conversation**: Maintains conversation history for contextual responses

## Setup

1. Get your Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
2. Enable the "AI Chat" module in the Modules menu
3. Enter your API key in the provided input field
4. Click "Connect" to initialize the connection

Your API key is stored locally in browser localStorage for convenience.

## Usage

### Starting a Conversation

1. Click the round microphone button to start listening
2. Speak your message clearly
3. The AI will respond with voice and facial expressions
4. The conversation continues automatically

### Manual Controls

- **Click mic (gray)**: Start listening for your voice
- **Click mic (green/pulsing)**: Stop listening
- The system automatically transitions between listening and speaking states

## Emotional Expression System

The AI can express 8 different emotions through facial Action Units:

### Available Emotions

1. **Happy** - Smile with cheek raise (AU6, AU12)
2. **Sad** - Downturned mouth with raised inner brows (AU1, AU4, AU15)
3. **Surprised** - Wide eyes, raised brows, open mouth (AU1, AU2, AU5, AU26)
4. **Angry** - Lowered brows, tightened lids (AU4, AU7, AU23)
5. **Disgusted** - Wrinkled nose, raised upper lip (AU9, AU10)
6. **Fearful** - Wide eyes, raised brows (AU1, AU2, AU4, AU5, AU20)
7. **Thinking** - Slight brow furrow, head tilt (AU4, AU55)
8. **Neutral** - Relaxed, no expression

### How Emotions Work

The AI automatically includes emotion markers in its responses:

```
User: "I just got my dream job!"
AI: "[EMOTION:happy] That's wonderful! I'm so happy for you!"
```

The emotion markers are:
- Parsed from the AI response
- Applied as facial expressions via Action Units
- Automatically timed and blended with speech
- Removed from the displayed text

### FACS to ARKit Mapping

Each emotion is encoded as a combination of Action Units:
- AU1: Inner Brow Raiser
- AU2: Outer Brow Raiser
- AU4: Brow Lowerer
- AU5: Upper Lid Raiser
- AU6: Cheek Raiser
- AU7: Lid Tightener
- AU9: Nose Wrinkler
- AU10: Upper Lip Raiser
- AU12: Lip Corner Puller
- AU15: Lip Corner Depressor
- AU20: Lip Stretcher
- AU23: Lip Tightener
- AU26: Jaw Drop
- AU33: Head Up
- AU55: Head Tilt Left

## Architecture

### Services Used

- **TTS Service**: Web Speech API for text-to-speech
- **Transcription Service**: Web Speech API for speech recognition
- **Lip Sync Service**: Phoneme extraction and viseme mapping
- **Conversation Service**: Turn-taking dialogue coordination
- **Eye/Head Tracking**: Gaze and idle movement
- **Anthropic API**: Claude 3.5 Sonnet for responses

### Animation Categories

- `combined`: Lip sync (visemes 0-14 + jaw AU26)
- `prosodic`: Natural speech gestures (brow raises, head nods)
- `emotion`: FACS-based emotional expressions

### Snippet Priorities

- Emotion: 40 (can be overridden by speech)
- Lip sync: 50 (main speech animation)
- Prosodic: 30 (subtle emphasis)

## System Prompt

The AI is configured with this system prompt:

> You are a friendly, expressive AI assistant with the ability to show emotions through facial expressions.
>
> When you want to express an emotion, include emotion markers in your response like this: [EMOTION:happy] or [EMOTION:surprised]
>
> Available emotions: happy, sad, surprised, angry, disgusted, fearful, thinking, neutral
>
> Use emotions naturally to enhance your responses.

## Technical Details

### Conversation Flow

1. User clicks mic → Start listening
2. User speaks → Transcription captures speech
3. Speech sent to Claude API with conversation history
4. Claude responds with text + emotion markers
5. Emotion extracted and applied via FACS
6. Response spoken via TTS with lip sync
7. Automatically returns to listening state

### Error Handling

- Network errors: Auto-retry after 500ms
- No speech detected: Auto-restart listening
- API errors: Display error message to user
- Missing API key: Prompt user to enter key

## Privacy & Security

- API key stored in browser localStorage only
- Conversation history maintained in memory (cleared on module stop)
- No data sent to servers except Anthropic API
- Uses `dangerouslyAllowBrowser: true` for client-side API calls

⚠️ **Note**: For production use, implement a backend proxy to secure your API key.
