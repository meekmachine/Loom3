

import React, { createContext, useContext, useMemo, useRef, useEffect, useState } from 'react';
import { createAnimationService } from '../latticework/animation/animationService';
import * as THREE from 'three';
import { EngineThree } from '../engine/EngineThree';

export type ThreeContextValue = {
  engine: EngineThree;
  clock: THREE.Clock;
  /** Animation service handle (singleton per provider instance) */
  anim: ReturnType<typeof createAnimationService>;
  /** Subscribe to the central frame loop. Returns an unsubscribe function. */
  addFrameListener: (callback: (deltaSeconds: number) => void) => () => void;
};

export const ThreeCtx = createContext<ThreeContextValue | null>(null);

export const ThreeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Singletons per provider instance
  const engineRef = useRef<EngineThree | undefined>(undefined);
  const clockRef = useRef<THREE.Clock | undefined>(undefined);
  const listenersRef = useRef(new Set<(dt: number) => void>());
  const rafIdRef = useRef<number | null>(null);
  const animRef = useRef<ReturnType<typeof createAnimationService> | undefined>(undefined);
  const [animReady, setAnimReady] = useState(false);

  // Ensure engine and clock are singletons
  if (!engineRef.current) engineRef.current = new EngineThree();
  if (!clockRef.current) clockRef.current = new THREE.Clock();

  // Ensure window.facslib is set before creating animation service
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).facslib = engineRef.current;
    }
  }, []);

  // Create animation service only after engineRef.current is ready and only once
  useEffect(() => {
    if (!animRef.current && engineRef.current) {
      // Set dev handle for facslib before creating anim
      if (typeof window !== 'undefined') {
        (window as any).facslib = engineRef.current;
      }

    const host = {
      applyAU: (id: number | string, v: number) => {
        // All AUs use regular handling - composite AUs (61, 63, 64, 31, 33, 54, etc.)
        // already handle blend shapes + bones through AU_TO_COMPOSITE_MAP in setAU()
        engineRef.current!.setAU(id as any, v);
      },
      setMorph: (key: string, v: number) => engineRef.current!.setMorph(key, v),
      transitionAU: (id: number | string, v: number, dur?: number) => engineRef.current!.transitionAU?.(id as any, v, dur),
      transitionMorph: (key: string, v: number, dur?: number) => engineRef.current!.transitionMorph?.(key, v, dur),
      // Continuum transition: handles AU pairs like eyes left/right, head up/down
      // Takes a single value from -1 to +1 and internally manages both AU values
      transitionContinuum: (negAU: number, posAU: number, v: number, dur?: number) =>
        engineRef.current!.transitionContinuum?.(negAU, posAU, v, dur),

      onSnippetEnd: (name: string) => {
        try {
          // Dispatch a window-level CustomEvent for any listeners (debug/UIs)
          window.dispatchEvent(new CustomEvent('visos:snippetEnd', { detail: { name } }));
        } catch {}
        try {
          // Convenience: stash last ended name for quick inspection
          (window as any).__lastSnippetEnded = name;
        } catch {}
      }
    };
      animRef.current = createAnimationService(host);
      (window as any).anim = animRef.current; // dev handle
      setAnimReady(true);
    }
  }, []);

  const startLoop = () => {
    if (rafIdRef.current != null) return;
    const tick = () => {
      const dt = clockRef.current!.getDelta();
      // Drive animation agency (VISOS parity): advance scheduler by central clock
      try {
        // Always step; scheduler internally no-ops when not playing.
        animRef.current?.step?.(dt);
      } catch {}
      // Notify subscribers (e.g., animation scheduler) first
      listenersRef.current.forEach((fn) => { try { fn(dt); } catch {} });
      // EngineThree transitions: advance by dt (central frame loop)
      engineRef.current!.update(dt);
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  };

  // Dispose animation service on unmount
  useEffect(() => {
    return () => {
      try { animRef.current?.dispose?.(); } catch {}
    };
  }, []);

  // Start loop only after anim service is ready
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!animRef.current) return;
    startLoop();
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animReady]);

  // Wait for anim service to be ready before providing context
  const value = useMemo<ThreeContextValue | null>(() => {
    if (!engineRef.current || !clockRef.current || !animRef.current) return null;
    return {
      engine: engineRef.current,
      clock: clockRef.current,
      anim: animRef.current,
      addFrameListener: (cb) => {
        listenersRef.current.add(cb);
        return () => listenersRef.current.delete(cb);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animReady]);

  if (!value) return null;
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
