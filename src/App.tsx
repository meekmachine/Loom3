import React, { useCallback, useState, useMemo, useEffect } from 'react';
import CharacterGLBScene from './scenes/CharacterGLBScene';
import SliderDrawer from './components/SliderDrawer';
import ModulesMenu from './components/ModulesMenu';
import Preloader from './components/Preloader';
import { useThreeState } from './context/threeContext';
import { ModulesProvider, useModulesContext } from './context/ModulesContext';
import { createEyeHeadTrackingService } from './latticework/eyeHeadTracking/eyeHeadTrackingService';
import { HairCustomizationPanel } from './components/hair/HairCustomizationPanel';
import { HairService } from './latticework/hair/hairService';
import './styles.css';

import { AU_TO_MORPHS } from './engine/arkit/shapeDict';

function AppContent() {
  const { engine, anim, setWindEngine } = useThreeState();
  const { setEyeHeadTrackingService } = useModulesContext();

  const [auditSummary, setAuditSummary] = useState<{ morphCount:number; totalAUs:number; fullCovered:number; partial:number; zero:number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hairService, setHairService] = useState<HairService | null>(null);

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
    ({ meshes, model, windEngine, hairService }: { meshes: any[]; model?: any; windEngine?: any; hairService?: HairService }) => {
      engine.onReady({ meshes, model });

      // Set wind engine in context if available
      if (windEngine) {
        setWindEngine(windEngine);
        // Expose wind engine globally for debugging
        if (typeof window !== 'undefined') {
          (window as any).windEngine = windEngine;
        }
      }

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
    [engine, anim, setWindEngine]
  );

  const handleProgress = useCallback((progress: number) => {
    setLoadingProgress(progress);
  }, []);

  // Initialize eye/head tracking service on app startup
  useEffect(() => {
    console.log('[App] Creating eye/head tracking service with animation scheduler');
    const service = createEyeHeadTrackingService({
      eyeTrackingEnabled: true,
      headTrackingEnabled: true,
      headFollowEyes: true,
      animationAgency: anim, // Pass animation agency for scheduling approach
      engine: engine, // Pass engine as fallback
    });

    service.start();
    setEyeHeadTrackingService(service);
    console.log('[App] ✓ Eye/head tracking service initialized and registered');

    // Test mouse tracking immediately
    service.setMode('mouse');
    console.log('[App] ✓ Mouse tracking enabled by default');

    return () => {
      console.log('[App] Cleaning up eye/head tracking service');
      service.dispose();
      setEyeHeadTrackingService(null);
    };
  }, [engine, setEyeHeadTrackingService]);

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
      />
      <ModulesMenu animationManager={anim} />

      {/* Hair Customization Panel - positioned in top right */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
      }}>
        <HairCustomizationPanel hairService={hairService} />
      </div>
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