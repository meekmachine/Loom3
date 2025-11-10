import React, { useCallback, useState, useMemo } from 'react';
import CharacterGLBScene from './scenes/CharacterGLBScene';
import SliderDrawer from './components/SliderDrawer';
import { useThreeState } from './context/threeContext';
import './styles.css';
import { Text } from '@chakra-ui/react';

import { AU_TO_MORPHS } from './engine/arkit/shapeDict';

export default function App() {
  const { engine, anim } = useThreeState();

  const [auditSummary, setAuditSummary] = useState<{ morphCount:number; totalAUs:number; fullCovered:number; partial:number; zero:number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    ({ meshes, model }: { meshes: any[]; model?: any }) => {
      engine.onReady({ meshes, model });
      try {
        const summary = auditMorphCoverage(model);
        setAuditSummary(summary);
      } catch {}
      anim?.play?.();
    },
    [engine, anim]
  );

  // Camera override memoized
  const cameraOverride = useMemo(() => ({
    position: [1.851, 5.597, 6.365] as [number, number, number],
    target:   [1.851, 5.597, -0.000] as [number, number, number],
  }), []);

  // Use CORS proxy for GitHub Release in production, local for dev
  // GitHub Releases don't have CORS headers, so we use allorigins.win as a proxy
  const glbSrc = import.meta.env.PROD
    ? "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://github.com/meekmachine/LoomLarge/releases/download/v1.0.0/jonathan.glb")
    : "/characters/jonathan.glb";

  return (
    <div className="fullscreen-scene">
      <CharacterGLBScene
        src={glbSrc}
        className="fullscreen-scene"
        cameraOverride={cameraOverride}
        skyboxUrl="/skyboxes/3BR2D07.jpg"
        onReady={handleReady}
      />
      <SliderDrawer isOpen={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
    </div>
  );
}