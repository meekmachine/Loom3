import React, { createContext, useContext, useMemo, useRef, useEffect, useState } from 'react';
import { createAnimationService } from '../latticework/animation/animationService';
import { EngineFour } from '../engine/EngineFour';

export type FiberContextValue = {
  engine: EngineFour;
  /** Animation service handle (singleton per provider instance) */
  anim: ReturnType<typeof createAnimationService>;
  /** Subscribe to the central frame loop. Returns an unsubscribe function. */
  addFrameListener: (callback: (deltaSeconds: number) => void) => () => void;
};

const FiberCtx = createContext<FiberContextValue | null>(null);

export const FiberProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Singletons per provider instance
  const engineRef = useRef<EngineFour | undefined>(undefined);
  const listenersRef = useRef(new Set<(dt: number) => void>());
  const animRef = useRef<ReturnType<typeof createAnimationService> | undefined>(undefined);
  const [animReady, setAnimReady] = useState(false);
  const [, forceUpdate] = useState({});

  // Ensure engine is singleton
  if (!engineRef.current) {
    // Pass state update callback to EngineFour for reactive updates
    engineRef.current = new EngineFour(() => forceUpdate({}));
  }

  // Ensure window.facslib is set before creating animation service
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).facslibFour = engineRef.current;
    }
  }, []);

  // Create animation service only after engineRef.current is ready and only once
  useEffect(() => {
    if (!animRef.current && engineRef.current) {
      // Set dev handle for facslib before creating anim
      if (typeof window !== 'undefined') {
        (window as any).facslibFour = engineRef.current;
      }
      const host = {
        applyAU: (id: number | string, v: number) => engineRef.current!.setAU(id as any, v),
        setMorph: (key: string, v: number) => engineRef.current!.setMorph(key, v),
        transitionAU: (id: number | string, v: number, dur?: number) => engineRef.current!.transitionAU?.(id as any, v, dur),
        transitionMorph: (key: string, v: number, dur?: number) => engineRef.current!.transitionMorph?.(key, v, dur),

        // Continuum helper methods for animation scheduler (instant)
        setEyesHorizontal: (v: number) => engineRef.current!.setEyesHorizontal?.(v),
        setEyesVertical: (v: number) => engineRef.current!.setEyesVertical?.(v),
        setHeadHorizontal: (v: number) => engineRef.current!.setHeadHorizontal?.(v),
        setHeadVertical: (v: number) => engineRef.current!.setHeadVertical?.(v),
        setHeadRoll: (v: number) => engineRef.current!.setHeadTilt?.(v), // EngineFour uses setHeadTilt
        setJawHorizontal: (v: number) => engineRef.current!.setJawHorizontal?.(v),
        setTongueHorizontal: (v: number) => engineRef.current!.setTongueHorizontal?.(v),
        setTongueVertical: (v: number) => engineRef.current!.setTongueVertical?.(v),

        // Continuum transition methods for animation scheduler (animated)
        transitionEyesHorizontal: (v: number, dur?: number) => engineRef.current!.transitionEyesHorizontal?.(v, dur),
        transitionEyesVertical: (v: number, dur?: number) => engineRef.current!.transitionEyesVertical?.(v, dur),
        transitionHeadHorizontal: (v: number, dur?: number) => engineRef.current!.transitionHeadHorizontal?.(v, dur),
        transitionHeadVertical: (v: number, dur?: number) => engineRef.current!.transitionHeadVertical?.(v, dur),
        transitionHeadRoll: (v: number, dur?: number) => engineRef.current!.transitionHeadRoll?.(v, dur),
        transitionJawHorizontal: (v: number, dur?: number) => engineRef.current!.transitionJawHorizontal?.(v, dur),
        transitionTongueHorizontal: (v: number, dur?: number) => engineRef.current!.transitionTongueHorizontal?.(v, dur),
        transitionTongueVertical: (v: number, dur?: number) => engineRef.current!.transitionTongueVertical?.(v, dur),

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
      (window as any).animFour = animRef.current; // dev handle
      setAnimReady(true);
    }
  }, []);

  // Dispose animation service on unmount
  useEffect(() => {
    return () => {
      try { animRef.current?.dispose?.(); } catch {}
    };
  }, []);

  // Note: EngineFour.update() is called by React Three Fiber's useFrame hook in CharacterFiberScene
  // The animation service step is also called from useFrame
  // We don't need a separate RAF loop here like ThreeContext

  // Wait for anim service to be ready before providing context
  const value = useMemo<FiberContextValue | null>(() => {
    if (!engineRef.current || !animRef.current) return null;
    return {
      engine: engineRef.current,
      anim: animRef.current,
      addFrameListener: (cb) => {
        listenersRef.current.add(cb);
        return () => listenersRef.current.delete(cb);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animReady]);

  if (!value) return null;
  return <FiberCtx.Provider value={value}>{children}</FiberCtx.Provider>;
};

export function useFiberState() {
  const ctx = useContext(FiberCtx);
  if (!ctx) throw new Error('useFiberState must be used within a FiberProvider');
  return ctx;
}
