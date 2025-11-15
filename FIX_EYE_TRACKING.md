# Simple Fix for Eye/Head Tracking

The fix is simple - just pass `animationManager` in the config:

```typescript
eyeHeadTrackingRef.current = createEyeHeadTrackingService({
  eyeTrackingEnabled: true,
  headTrackingEnabled: true,
  headFollowEyes: true,
  idleVariation: false,
  animationManager: animationManager, // THIS IS THE KEY!
});

eyeHeadTrackingRef.current.start();

// Mouse tracking
const handleMouseMove = (e: MouseEvent) => {
  if (!eyeHeadTrackingRef.current) return;
  const x = -((e.clientX / window.innerWidth) * 2 - 1);
  const y = -(e.clientY / window.innerHeight) * 2 + 1;
  eyeHeadTrackingRef.current.setGazeTarget({ x, y, z: 0 });
};
window.addEventListener('mousemove', handleMouseMove);
```

The eye/head tracking service handles everything internally when you pass animationManager!
