# Eye/Head Tracking Agency - Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for the Eye/Head Tracking Agency, covering unit tests, integration tests, and end-to-end validation.

## Testing Layers

### 1. Unit Tests (Service Level)

Test the core `EyeHeadTrackingService` in isolation:

#### Configuration Tests
- **Test**: Default configuration values are applied correctly
- **Test**: Config updates propagate to submachines
- **Test**: Invalid config values are handled gracefully

#### Coordinate Processing Tests
- **Test**: Mouse coordinates are negated correctly (mirror behavior)
  ```typescript
  // Mouse at screen (100, 50) → normalized (-0.5, 0.2)
  // Should negate BOTH X and Y
  expect(gazeX).toBe(0.5);  // Negated for mirror
  expect(gazeY).toBe(-0.2); // Negated for coordinate flip
  ```

- **Test**: Webcam coordinates handle pre-mirrored input
  ```typescript
  // Webcam landmark at (0.3, 0.6) → normalized (0.2, -0.2)
  // Should NOT negate X (already mirrored), but negate Y
  expect(gazeX).toBe(-0.4);  // No negation - camera mirrors
  expect(gazeY).toBe(-0.2);  // Negated for coordinate flip
  ```

- **Test**: Manual gaze targets are passed through unchanged
  ```typescript
  service.setGazeTarget({ x: 0.5, y: 0.3 });
  expect(currentGaze).toEqual({ x: 0.5, y: 0.3, z: 0 });
  ```

#### State Management Tests
- **Test**: Service starts/stops correctly
- **Test**: Speaking state disables idle variation
- **Test**: Listening state triggers look-at-speaker
- **Test**: Blink timing is calculated from blink rate

#### Mode Switching Tests
- **Test**: Switching from manual to mouse attaches event listener
- **Test**: Switching from mouse to webcam removes mouse listener
- **Test**: Switching modes cleans up previous mode resources
- **Test**: Mode state persists correctly

### 2. Scheduler Tests (Animation Agency Mode)

Test the `EyeHeadTrackingScheduler` animation snippet generation:

#### Directional AU Scheduling
- **Test**: Positive yaw schedules AU 62 (eye yaw right)
  ```typescript
  scheduler.scheduleGazeTransition({ x: 0.5, y: 0 });
  expect(scheduledSnippet.curves['62']).toBeDefined();
  expect(scheduledSnippet.curves['62'][1].intensity).toBeCloseTo(0.5);
  ```

- **Test**: Negative yaw schedules AU 61 (eye yaw left)
  ```typescript
  scheduler.scheduleGazeTransition({ x: -0.5, y: 0 });
  expect(scheduledSnippet.curves['61']).toBeDefined();
  expect(scheduledSnippet.curves['61'][1].intensity).toBeCloseTo(0.5);
  ```

- **Test**: Combined movements schedule multiple AUs
  ```typescript
  scheduler.scheduleGazeTransition({ x: 0.3, y: -0.4 });
  // Should schedule AU 62 (yaw right) AND AU 64 (pitch down)
  expect(scheduledSnippet.curves['62']).toBeDefined();
  expect(scheduledSnippet.curves['64']).toBeDefined();
  ```

#### Smooth Transitions
- **Test**: Direction reversal schedules BOTH directional AUs
  ```typescript
  // Start looking left
  scheduler.scheduleGazeTransition({ x: -0.5, y: 0 });
  // Switch to looking right
  scheduler.scheduleGazeTransition({ x: 0.5, y: 0 });

  // Both AU 61 (left) and AU 62 (right) should be in curves
  // AU 61 animates from 0.5 → 0
  // AU 62 animates from 0 → 0.5
  expect(snippet.curves['61'][0].intensity).toBeCloseTo(0.5);
  expect(snippet.curves['61'][1].intensity).toBeCloseTo(0);
  expect(snippet.curves['62'][0].intensity).toBeCloseTo(0);
  expect(snippet.curves['62'][1].intensity).toBeCloseTo(0.5);
  ```

- **Test**: Adaptive duration scales with movement distance
  ```typescript
  // Small movement → shorter duration
  scheduler.scheduleGazeTransition({ x: 0.1, y: 0 });
  expect(duration).toBeLessThan(200);

  // Large movement → longer duration
  scheduler.scheduleGazeTransition({ x: 1.0, y: 0 });
  expect(duration).toBeCloseTo(200);
  ```

#### Intensity Scaling
- **Test**: Eye intensity config scales AU values
  ```typescript
  scheduler.updateConfig({ eyeIntensity: 0.5 });
  scheduler.scheduleGazeTransition({ x: 1.0, y: 0 });
  expect(snippet.curves['62'][1].intensity).toBeCloseTo(0.5); // 1.0 * 0.5
  ```

- **Test**: Head intensity config scales head AU values
  ```typescript
  scheduler.updateConfig({ headIntensity: 0.3 });
  scheduler.scheduleGazeTransition({ x: 1.0, y: 0 });
  expect(headSnippet.curves['52'][1].intensity).toBeCloseTo(0.3); // 1.0 * 0.3
  ```

#### Priority Settings
- **Test**: Eye snippets use correct priority (20)
- **Test**: Head snippets use correct priority (15)
- **Test**: Priority overrides are respected

### 3. State Machine Tests

Test the XState submachines (eye and head):

#### Eye Machine Tests
- **Test**: Transitions from idle to tracking on START_TRACKING
- **Test**: SET_GAZE event updates target gaze
- **Test**: BLINK event triggers blink state
- **Test**: UPDATE_CONFIG updates context values

#### Head Machine Tests
- **Test**: FOLLOW_EYES event triggers delayed follow
- **Test**: Follow delay timer works correctly
- **Test**: SET_POSITION moves head independently

### 4. Integration Tests

Test the full service integrated with real dependencies:

#### Animation Agency Integration
- **Test**: Scheduler snippets are scheduled via animation agency
  ```typescript
  const mockAnim = createMockAnimationService();
  const service = createEyeHeadTrackingService({
    animationAgency: mockAnim
  });

  service.setGazeTarget({ x: 0.5, y: 0 });

  expect(mockAnim.scheduleSnippet).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'eyeHeadTracking/eyes',
      snippetCategory: 'eyeHeadTracking',
      snippetPriority: 20
    })
  );
  ```

- **Test**: Old snippets are removed before scheduling new ones
- **Test**: Animation blending works with lip-sync snippets

#### Engine Integration (Direct Composite Mode)
- **Test**: Direct composite calls use correct API
  ```typescript
  const mockEngine = createMockEngine();
  const service = createEyeHeadTrackingService({
    engine: mockEngine
  });

  service.setGazeTarget({ x: 0.5, y: 0.3 });

  expect(mockEngine.applyEyeComposite).toHaveBeenCalledWith(0.5, 0.3);
  expect(mockEngine.applyHeadComposite).toHaveBeenCalledWith(0.25, 0.15, 0);
  ```

- **Test**: Intensity scaling applies to composite calls

#### Webcam Integration
- **Test**: Webcam tracking instance is set correctly
- **Test**: Face landmarks are processed with correct coordinate transform
- **Test**: Missing webcam instance is handled gracefully

### 5. End-to-End Tests

Test complete user workflows:

#### Mouse Tracking Flow
1. Initialize service
2. Set mode to 'mouse'
3. Simulate mouse move events
4. Verify gaze target updates
5. Verify animation snippets or composite calls
6. Switch to manual mode
7. Verify mouse listener is removed

#### Webcam Tracking Flow
1. Initialize service with webcam support
2. Set mode to 'webcam'
3. Provide mock webcam instance
4. Simulate face detection landmarks
5. Verify coordinate processing (X not negated, Y negated)
6. Verify gaze target updates
7. Stop webcam tracking
8. Verify cleanup

#### Speech Coordination Flow
1. Start service
2. Call setSpeaking(true)
3. Verify idle variation stops
4. Trigger gaze changes during speech
5. Call setSpeaking(false)
6. Verify idle variation resumes

### 6. Edge Cases and Error Handling

- **Test**: Missing engine and animation agency logs warning
- **Test**: Invalid gaze coordinates are clamped to [-1, 1]
- **Test**: Rapid gaze changes don't queue excessive snippets
- **Test**: Disposing service cleans up all timers and listeners
- **Test**: Service handles stop() when already stopped
- **Test**: Service handles start() when already started

## Mock Strategy

### Mock Animation Agency
```typescript
const createMockAnimationService = () => ({
  scheduleSnippet: jest.fn((snippet) => snippet.name),
  removeSnippet: jest.fn(),
  onSnippetEnd: jest.fn(),
});
```

### Mock Engine
```typescript
const createMockEngine = () => ({
  applyEyeComposite: jest.fn(),
  applyHeadComposite: jest.fn(),
  setAU: jest.fn(),
});
```

### Mock Webcam Instance
```typescript
const createMockWebcam = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  detectFace: jest.fn(() => ({
    landmarks: [
      { x: 0.3, y: 0.4 }, // Left eye
      { x: 0.7, y: 0.4 }, // Right eye
    ]
  }))
});
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage of service, scheduler, and machines
- **Integration Tests**: All major integration points covered
- **E2E Tests**: All user workflows covered
- **Edge Cases**: All error paths and boundary conditions covered

## Testing Tools

- **Test Framework**: Vitest (already in project)
- **Assertion Library**: Vitest assertions
- **Mocking**: Vitest mocks
- **State Machine Testing**: XState testing utilities
- **Coverage**: Vitest coverage reports

## Continuous Integration

- Run tests on every commit
- Fail build if coverage drops below 70%
- Run E2E tests on pull requests
- Performance benchmarks for scheduling overhead

## Performance Tests

- **Test**: Gaze update performance (should be < 1ms)
- **Test**: Scheduler overhead (should be < 5ms per transition)
- **Test**: Memory leaks (service should clean up all resources)
- **Test**: Animation snippet accumulation (old snippets removed)

## Visual/Manual Testing

While automated tests cover logic, manual testing is needed for:

1. **Visual smoothness**: Do transitions look natural?
2. **Coordinate accuracy**: Does webcam tracking feel correct?
3. **Blend quality**: Do eye/head movements blend well with lip-sync?
4. **Latency**: Is tracking responsive enough?

## Next Steps

1. Set up test infrastructure (if not already present)
2. Implement unit tests for coordinate processing
3. Implement scheduler tests for directional AU logic
4. Add integration tests for animation agency mode
5. Add E2E tests for each input mode
6. Set up CI pipeline for automated testing
