import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import CharacterGLBScene from './scenes/CharacterGLBScene';
import SliderDrawer from './components/SliderDrawer';
import ModulesMenu from './components/ModulesMenu';
import Preloader from './components/Preloader';
import { useThreeState } from './context/threeContext';
import { ModulesProvider, useModulesContext } from './context/ModulesContext';
import { createEyeHeadTrackingService } from './latticework/eyeHeadTracking/eyeHeadTrackingService';
import { HairService } from './latticework/hair/hairService';
import { BlinkService } from './latticework/blink/blinkService';
import './styles.css';
import { setupGLBCacheDebug } from './utils/glbCacheDebug';

import { AU_TO_MORPHS } from './engine/arkit/shapeDict';

function AppContent() {
  const { engine, anim } = useThreeState();
  const { setEyeHeadTrackingService } = useModulesContext();

  const [auditSummary, setAuditSummary] = useState<{ morphCount:number; totalAUs:number; fullCovered:number; partial:number; zero:number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hairService, setHairService] = useState<HairService | null>(null);
  const [blinkService, setBlinkService] = useState<BlinkService | null>(null);

  // Helper: audit morph coverage
  function auditMorphCoverage(model: any) {
    const morphs = new Set<string>();
    try {
      model?.traverse?.((obj: any) => {
        const dict = obj?.morphTargetDictionary;
        if (dict && typeof dict === 'object') {
          Object.keys(dict).forEach(k => morphs.add(k));
        }
      });
    } catch {}
    const mapping = AU_TO_MORPHS || {};
    const rows: Array<{ au: string; mapped: string[]; present: string[]; missing: string[] }> = [];
    Object.entries(mapping).forEach(([au, keys]: [string, string[]]) => {
      const present = keys.filter(k => morphs.has(k));
      const missing = keys.filter(k => !morphs.has(k));
      rows.push({ au, mapped: keys, present, missing });
    });
    // Summaries
    const totalAUs = rows.length;
    const fullCovered = rows.filter(r => r.missing.length === 0).length;
    const partial = rows.filter(r => r.present.length > 0 && r.missing.length > 0).length;
    const zero = rows.filter(r => r.present.length === 0).length;
    console.groupCollapsed('%c[AU↔Morph Audit] GLB morph coverage vs ShapeDict', 'color:#8be9fd');
    console.log('Morph count in GLB:', morphs.size);
    console.log('AUs total:', totalAUs, '| fully covered:', fullCovered, '| partial:', partial, '| zero coverage:', zero);
    console.table(rows.map(r => ({
      AU: r.au,
      mapped: r.mapped.join(', '),
      present: r.present.join(', '),
      missing: r.missing.join(', ')
    })));
    console.groupEnd();
    return { morphCount: morphs.size, totalAUs, fullCovered, partial, zero };
  }

  const handleReady = useCallback(
    ({ meshes, model, hairService }: { meshes: any[]; model?: any; hairService?: HairService }) => {
      engine.onReady({ meshes, model });

      // Set hair service if available
      if (hairService) {
        setHairService(hairService);
        // Expose hair service globally for debugging
        if (typeof window !== 'undefined') {
          (window as any).hairService = hairService;
        }
      }

      try {
        const summary = auditMorphCoverage(model);
        setAuditSummary(summary);
      } catch {}
      anim?.play?.();
      setIsLoading(false);
    },
    [engine, anim]
  );

  const handleProgress = useCallback((progress: number) => {
    setLoadingProgress(progress);
  }, []);

  // Initialize GLB cache debug utilities
  useEffect(() => {
    setupGLBCacheDebug();
  }, []);

  // Initialize eye/head tracking service when both engine and anim are ready
  useEffect(() => {
    if (!engine || !anim) return;

    console.log('[App] Creating eye/head tracking service with animation scheduler');
    const service = createEyeHeadTrackingService({
      // Use default config - disabled by default, can be enabled in UI
      animationAgency: anim, // Pass animation agency for scheduling approach
      engine: engine, // Pass engine as fallback
    });

    service.start();
    setEyeHeadTrackingService(service);
    console.log('[App] ✓ Eye/head tracking service initialized (disabled by default)');

    return () => {
      console.log('[App] Cleaning up eye/head tracking service');
      service.dispose();
      setEyeHeadTrackingService(null);
    };
  }, [engine, anim, setEyeHeadTrackingService]);

  // Initialize blink service when animation service is ready
  useEffect(() => {
    if (!anim) return;

    console.log('[App] Creating blink service with animation scheduler');
    const service = new BlinkService({
      scheduleSnippet: (snippet: any) => {
        return anim.schedule?.(snippet) || null;
      },
      removeSnippet: (name: string) => {
        anim.remove?.(name);
      },
    });

    setBlinkService(service);

    // Expose blink service globally for debugging
    if (typeof window !== 'undefined') {
      (window as any).blinkService = service;
    }

    console.log('[App] ✓ Blink service initialized and registered');

    return () => {
      console.log('[App] Cleaning up blink service');
      service.dispose();
      setBlinkService(null);
    };
  }, [anim]);

  // Camera override memoized
  const cameraOverride = useMemo(() => ({
    position: [1.851, 5.597, 6.365] as [number, number, number],
    target:   [1.851, 5.597, -0.000] as [number, number, number],
  }), []);

  // Use BASE_URL for all assets to work with GitHub Pages base path
  const glbSrc = import.meta.env.BASE_URL + "characters/jonathan_new.glb";
  const skyboxUrl = import.meta.env.BASE_URL + "skyboxes/3BR2D07.jpg";

  return (
    <div className="fullscreen-scene">
      <Preloader
        text="Loading Model"
        progress={loadingProgress}
        show={isLoading}
        skyboxUrl={skyboxUrl}
      />

      <CharacterGLBScene
        src={glbSrc}
        className="fullscreen-scene"
        cameraOverride={cameraOverride}
        skyboxUrl={skyboxUrl}
        onReady={handleReady}
        onProgress={handleProgress}
      />

      <SliderDrawer
        isOpen={drawerOpen}
        onToggle={() => setDrawerOpen(!drawerOpen)}
        disabled={isLoading}
        hairService={hairService}
        blinkService={blinkService}
      />
      <ModulesMenu animationManager={anim} />
    </div>
  );
}

export default function App() {
  return (
    <ModulesProvider>
      <AppContent />
    </ModulesProvider>
  );
}
