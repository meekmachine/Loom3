import React, { createContext, useContext, useRef, useEffect } from 'react';
import { EngineThree } from '../engine/EngineThree';

export type ThreeContextValue = {
  engine: EngineThree;
  /** Animation service handle (owned by EngineThree) */
  anim: EngineThree['anim'];
  /** Subscribe to the central frame loop. Returns an unsubscribe function. */
  addFrameListener: (callback: (deltaSeconds: number) => void) => () => void;
};

export const ThreeCtx = createContext<ThreeContextValue | null>(null);

/**
 * ThreeProvider - Provides EngineThree and animation service via React context.
 *
 * EngineThree owns the RAF loop and animation service.
 * This provider just creates the engine singleton and exposes it to React.
 */
export const ThreeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const engineRef = useRef<EngineThree | null>(null);

  // Create engine singleton
  if (!engineRef.current) {
    engineRef.current = new EngineThree();
    // Set dev handle
    if (typeof window !== 'undefined') {
      (window as any).facslib = engineRef.current;
    }
  }

  // Start engine on mount, stop on unmount
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.start();

    return () => {
      engine.dispose();
    };
  }, []);

  const engine = engineRef.current;
  if (!engine) return null;

  const value: ThreeContextValue = {
    engine,
    anim: engine.anim,
    addFrameListener: (cb) => engine.addFrameListener(cb),
  };

  return <ThreeCtx.Provider value={value}>{children}</ThreeCtx.Provider>;
};

export function useThreeState() {
  const ctx = useContext(ThreeCtx);
  if (!ctx) throw new Error('useThreeState must be used within a ThreeProvider');
  return ctx;
}

export function useThreeOptional() {
  return useContext(ThreeCtx);
}
