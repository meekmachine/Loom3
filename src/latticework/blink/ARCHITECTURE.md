# Blink Agency Architecture

## Overview

The blink agency implements automatic and manual character blinking using the latticework agency pattern. It follows the same architectural principles as the hair and lipsync agencies.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  Creates BlinkService with animation host capabilities       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ passes service to
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   SliderDrawer.tsx                           │
│  Renders BlinkSection component with blinkService            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ uses
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   BlinkSection.tsx                           │
│  - UI controls for blink parameters                          │
│  - Subscribes to state changes                               │
│  - Calls service methods on user interaction                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ controls
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   BlinkService                               │
│  - Coordinates machine and scheduler                         │
│  - Provides public API                                       │
│  - Manages subscriptions                                     │
│  - Handles automatic blinking based on state                 │
└────────────┬──────────────────────┬─────────────────────────┘
             │                      │
   creates   │                      │ creates
   & manages │                      │ & manages
             ↓                      ↓
┌──────────────────────┐  ┌────────────────────────┐
│   BlinkMachine       │  │   BlinkScheduler       │
│   (XState)           │  │                        │
│                      │  │  - Timing logic        │
│  - State management  │  │  - Curve building      │
│  - Event handling    │  │  - Auto-scheduling     │
│  - Validation        │  │  - Manual triggers     │
└──────────┬───────────┘  └────────┬───────────────┘
           │                       │
           │ state updates         │ schedules
           │ notify service        │ animations
           │                       │
           └───────────┬───────────┘
                       │
                       │ both integrated with
                       ↓
         ┌──────────────────────────┐
         │   Animation Service      │
         │  - Snippet scheduling    │
         │  - Animation playback    │
         └──────────────────────────┘
```

## Data Flow

### Initialization Flow
```
1. App.tsx creates BlinkService when anim is ready
2. BlinkService creates blinkMachine actor
3. BlinkService creates BlinkScheduler
4. BlinkService subscribes to machine state changes
5. If enabled by default, scheduler.start() is called
6. Service is passed to SliderDrawer → BlinkSection
7. BlinkSection subscribes to service state updates
```

### Automatic Blinking Flow
```
1. Machine state has enabled=true
2. Service detects enabled state change
3. Service calls scheduler.start(frequency)
4. Scheduler schedules next blink with random interval
5. Scheduler.triggerBlink() is called automatically
6. Scheduler builds animation curves
7. Scheduler schedules snippet to animation service
8. Machine receives TRIGGER_BLINK event
9. Machine updates lastBlinkTime and scheduledBlinkCount
10. After blink duration, snippet is auto-removed
11. Timer triggers next blink
```

### Manual Blinking Flow
```
1. User clicks "Trigger Blink Now" button
2. BlinkSection calls blinkService.triggerBlink()
3. Service calls scheduler.triggerBlink()
4. Scheduler builds animation curves immediately
5. Scheduler schedules snippet to animation service
6. Machine receives TRIGGER_BLINK event
7. After blink duration, snippet is auto-removed
```

### Parameter Change Flow
```
1. User adjusts slider in BlinkSection
2. BlinkSection calls service method (e.g., setFrequency)
3. Service sends event to machine
4. Machine updates context.state
5. Machine notifies subscribers (including service)
6. Service updates scheduler config
7. If enabled, scheduler restarts with new frequency
8. BlinkSection receives state update via subscription
9. UI updates to reflect new value
```

## State Management

### Machine Context
```typescript
{
  state: BlinkState,          // Current configuration
  lastBlinkTime: number|null, // Timestamp of last blink
  scheduledBlinkCount: number // Total blinks scheduled
}
```

### Machine Events
- `ENABLE` / `DISABLE`: Toggle automatic blinking
- `SET_FREQUENCY`: Change blinks per minute
- `SET_DURATION`: Change blink duration
- `SET_INTENSITY`: Change blink strength
- `SET_RANDOMNESS`: Change variation amount
- `TRIGGER_BLINK`: Record that a blink was triggered
- `RESET_TO_DEFAULT`: Return to default settings

### Machine States
The machine uses a simple single-state design (idle) with actions handling all events. This is appropriate because:
- No complex state transitions needed
- All events can be processed at any time
- State is primarily data-driven rather than mode-driven

## Scheduler Responsibilities

### Timing
- Calculates intervals based on frequency and randomness
- Manages automatic blink timer
- Prevents overlapping blinks

### Animation Curves
- Builds realistic blink curves using AU 43
- Applies natural timing: 35% close, 10% hold, 55% open
- Adds randomness to intensity

### Integration
- Schedules snippets to animation service
- Sets high priority (100) to override other animations
- Auto-removes completed snippets

## Service Responsibilities

### Coordination
- Creates and manages machine actor
- Creates and manages scheduler
- Synchronizes state between machine and scheduler

### API
- Provides clean public interface for control
- Handles state queries
- Manages subscriptions

### Lifecycle
- Starts automatic blinking when enabled
- Stops automatic blinking when disabled
- Cleans up resources on disposal

## Comparison with Other Agencies

### Similar to Hair Agency
- Simple state management
- Direct updates without complex transitions
- Subscribe/notify pattern for UI updates
- Engine integration for rendering

### Similar to LipSync Agency
- Uses scheduler for complex timing
- Integrates with animation service
- Event-driven architecture
- Snippet-based animations

### Key Differences
- **Simpler than LipSync**: No word processing or phoneme extraction
- **More autonomous than Hair**: Has automatic scheduling logic
- **Different scope**: Focuses on timing rather than rendering or processing

## Extension Points

The architecture supports future enhancements:

1. **Asymmetric Blinks**: Add separate left/right eye support in scheduler
2. **Context Awareness**: Add new machine events for activity context
3. **Emotional States**: Extend scheduler config with emotion parameters
4. **Synchronization**: Add coordination with other agencies via shared state

## Design Principles

1. **Separation of Concerns**: Machine handles state, scheduler handles timing, service coordinates
2. **Single Responsibility**: Each component has one clear purpose
3. **Dependency Injection**: Animation service is injected, not hardcoded
4. **Reactive Updates**: Subscribers notified of state changes automatically
5. **Fail-Safe**: Handles missing animation service gracefully
6. **Testable**: Components can be tested independently
