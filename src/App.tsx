import React, { useCallback, useState, useMemo, useEffect } from 'react';
import CharacterGLBScene from './scenes/CharacterGLBScene';
import { CharacterFiberScene } from './scenes/CharacterFiberScene';
import SliderDrawer from './components/SliderDrawer';
import ModulesMenu from './components/ModulesMenu';
import Preloader from './components/Preloader';
import { useThreeState } from './context/threeContext';
import { ModulesProvider, useModulesContext } from './context/ModulesContext';
import { createEyeHeadTrackingService } from './latticework/eyeHeadTracking/eyeHeadTrackingService';
import { EngineType, SceneType } from './components/au/EngineSceneSwitcher';
import { EngineFour } from './engine/EngineFour';
import './styles.css';
import { Text } from '@chakra-ui/react';

import { AU_TO_MORPHS } from './engine/arkit/shapeDict';

function AppContent() {
  const { engine, anim, setWindEngine } = useThreeState();
  const { setEyeHeadTrackingService } = useModulesContext();

  const [auditSummary, setAuditSummary] = useState<{ morphCount:number; totalAUs:number; fullCovered:number; partial:number; zero:number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentEngine, setCurrentEngine] = useState<EngineType>('three');
  const [currentScene, setCurrentScene] = useState<SceneType>('glb');
  const [fiberEngine, setFiberEngine] = useState<EngineFour | null>(null);

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
    ({ meshes, model, windEngine }: { meshes: any[]; model?: any; windEngine?: any }) => {
      engine.onReady({ meshes, model });

      // Set wind engine in context if available
      if (windEngine) {
        setWindEngine(windEngine);
        // Expose wind engine globally for debugging
        if (typeof window !== 'undefined') {
          (window as any).windEngine = windEngine;
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

  // Handle engine changes
  const handleEngineChange = useCallback((newEngine: EngineType) => {
    console.log('[App] Switching engine to:', newEngine);
    setCurrentEngine(newEngine);

    // If switching to fiber and engine doesn't exist yet, create it
    if (newEngine === 'fiber' && !fiberEngine) {
      const newFiberEngine = new EngineFour(() => {
        // Optional state change callback
      });
      setFiberEngine(newFiberEngine);

      // Expose to window for debugging
      if (typeof window !== 'undefined') {
        (window as any).engineFour = newFiberEngine;
      }
    }
  }, [fiberEngine]);

  // Handle scene changes
  const handleSceneChange = useCallback((newScene: SceneType) => {
    console.log('[App] Switching scene to:', newScene);
    setCurrentScene(newScene);
    setIsLoading(true);
    setLoadingProgress(0);
  }, []);

  // Initialize eye/head tracking service on app startup
  useEffect(() => {
    if (!engine) {
      console.log('[App] Waiting for engine...');
      return;
    }

    console.log('[App] Creating standalone eye/head tracking service with animation manager:', anim);
    const service = createEyeHeadTrackingService({
      eyeTrackingEnabled: true,
      headTrackingEnabled: true,
      headFollowEyes: true,
      animationManager: anim, // Pass animation manager, not engine
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
  const glbSrc = import.meta.env.BASE_URL + "characters/jonathan.glb";
  const skyboxUrl = import.meta.env.BASE_URL + "skyboxes/3BR2D07.jpg";

  return (
    <div className="fullscreen-scene">
      <Preloader
        text="Loading Model"
        progress={loadingProgress}
        show={isLoading}
        skyboxUrl={skyboxUrl}
      />

      {/* Conditionally render scene based on currentScene */}
      {currentScene === 'glb' ? (
        <CharacterGLBScene
          src={glbSrc}
          className="fullscreen-scene"
          cameraOverride={cameraOverride}
          skyboxUrl={skyboxUrl}
          onReady={handleReady}
          onProgress={handleProgress}
        />
      ) : (
        <CharacterFiberScene
          src={glbSrc}
          className="fullscreen-scene"
          skyboxUrl={skyboxUrl}
          environmentPreset="studio"
          onReady={handleReady}
          onProgress={handleProgress}
        />
      )}

      <SliderDrawer
        isOpen={drawerOpen}
        onToggle={() => setDrawerOpen(!drawerOpen)}
        disabled={isLoading}
        currentEngine={currentEngine}
        currentScene={currentScene}
        onEngineChange={handleEngineChange}
        onSceneChange={handleSceneChange}
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