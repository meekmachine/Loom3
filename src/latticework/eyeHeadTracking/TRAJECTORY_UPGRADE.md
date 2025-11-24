# Trajectory-Based Timing Upgrade

## Summary

Upgraded the eye/head tracking scheduler from fixed adaptive timing to a more sophisticated trajectory-based system with independent eye and head lag timing.

## Backup Files

Working versions saved before upgrade:
- `eyeHeadTrackingScheduler_v2_adaptive_working.ts` - Original adaptive scheduler
- `eyeHeadTrackingService_adaptive_working.ts` - Original service

## Key Changes

### 1. Enhanced Configuration (`GazeTransitionConfig`)

Added trajectory-based timing parameters while maintaining backward compatibility:

```typescript
{
  duration: 200,             // Base duration (same as before)
  minDurationScale: 0.3,     // 60ms minimum (same as before: 200 * 0.3)
  maxDurationScale: 2.0,     // 400ms maximum (extended from 200ms for graceful large movements)
  distanceScaling: 2.0,      // Distance divisor (preserves original formula)
  headLagMultiplier: 1.3,    // Head takes 30% longer than eyes for graceful follow-through
}
```

### 2. Separate Eye and Head Durations

**Before:**
- Single `adaptiveDuration` used for both eyes and head
- Formula: `duration * clamp(0.3, 1.0, eyeDistance / 2)`

**After:**
- Independent `eyeDuration` and `headDuration`
- Eye formula: `duration * clamp(minScale, maxScale, eyeDistance / distanceScaling)`
- Head formula: `eyeH duration * headLagMultiplier`

This creates natural follow-through where the head lags behind eye movements.

### 3. Service Integration

The service now:
- Initializes the scheduler when `animationAgency` is available
- Falls back to direct engine approach when no animation agency
- Properly cleans up scheduler on disposal

```typescript
if (this.scheduler) {
  this.scheduler.scheduleGazeTransition(target, {
    eyeEnabled: this.config.eyeTrackingEnabled,
    headEnabled: this.config.headTrackingEnabled,
    headFollowEyes: this.config.headFollowEyes,
  });
}
```

## Behavioral Improvements

### Small Movements (distance < 0.6)
- **Duration**: 60-120ms
- **Behavior**: Quick, responsive tracking
- **Head lag**: Minimal (head nearly keeps up with eyes)

### Medium Movements (distance 0.6-1.0)
- **Duration**: 120-200ms eyes, 156-260ms head
- **Behavior**: Natural coordination
- **Head lag**: Noticeable 30% lag creates graceful follow

### Large Movements (distance > 1.0)
- **Duration**: 200-400ms eyes, 260-520ms head
- **Behavior**: Smooth, graceful transitions
- **Head lag**: Significant lag creates natural weight and inertia

## Compatibility

The new system preserves the original adaptive behavior:
- Same minimum duration (60ms)
- Same formula structure (distance-based scaling)
- Extended maximum for better large movement handling (200ms → 400ms)
- Added head lag for more natural motion

## Tuning Guide

To adjust behavior, modify these parameters in the service initialization:

**Make movements faster overall:**
```typescript
maxDurationScale: 1.5,  // Reduce max from 2.0
```

**Increase head lag for more dramatic follow-through:**
```typescript
headLagMultiplier: 1.5,  // Increase from 1.3
```

**Make small movements more responsive:**
```typescript
minDurationScale: 0.2,  // Reduce from 0.3 (40ms minimum)
```

**Make movements scale more with distance:**
```typescript
distanceScaling: 1.5,  // Reduce from 2.0 (movements scale faster)
```

## Testing

The system is now live and can be tested by:
1. Moving the mouse slowly → should see smooth, coordinated tracking
2. Moving the mouse quickly → should see head lag behind eyes
3. Small corrections → should feel responsive
4. Large sweeps → should feel graceful and weighted

Check console logs for timing information:
- `✓ Eye gaze: ... over XXXms`
- `✓ Head gaze: ... over XXXms (lag: 1.3x)`
