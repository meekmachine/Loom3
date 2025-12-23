import React, { createContext, useContext, useRef, useEffect } from 'react';
import { EngineThree } from '../engine/EngineThree';

export type ThreeContextValue = {
  engine: EngineThree;
  /** Animation service handle (lazy getter - defers initialization until first access) */
  get anim(): EngineThree['anim'];
};

const ThreeCtx = createContext<ThreeContextValue | null>(null);

/**
 * ThreeProvider - Provides EngineThree and animation service via React context.
 *
 * EngineThree owns the RAF loop and animation service.
 * This provider just creates the engine singleton and exposes it to React.
 */
export const ThreeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const engineRef = useRef<EngineThree | null>(null);

  // Create engine singleton (once, outside of render cycle)
  if (!engineRef.current) {
    engineRef.current = new EngineThree();
    if (typeof window !== 'undefined') {
      (window as any).engine = engineRef.current;
    }
  }

  const engine = engineRef.current;

  // Start engine on mount, stop on unmount
  useEffect(() => {
    engine.start();
    return () => engine.dispose();
  }, [engine]);

  // Stable context value - engine reference never changes
  const valueRef = useRef<ThreeContextValue | null>(null);
  if (!valueRef.current) {
    valueRef.current = {
      engine,
      get anim() { return engine.anim; },
    };
  }

  return <ThreeCtx.Provider value={valueRef.current}>{children}</ThreeCtx.Provider>;
};

export function useThreeState() {
  const ctx = useContext(ThreeCtx);
  if (!ctx) throw new Error('useThreeState must be used within a ThreeProvider');
  return ctx;
}

export function useThreeOptional() {
  return useContext(ThreeCtx);
}
