import * as THREE from 'three';
import { Loom3, collectMorphMeshes } from '@lovelace_lol/loom3';
import { runLoom3RendererBenchmark } from '../renderer-benchmark/shared/benchmark.js';

const mount = document.getElementById('app');
const status = document.getElementById('status');

function createRenderer() {
  return new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
}

async function run() {
  const renderer = createRenderer();
  status.textContent = 'WebGL benchmark running. Open the browser console for tables.';
  const result = await runLoom3RendererBenchmark({
    THREE,
    Loom3,
    collectMorphMeshes,
    renderer,
    rendererLabel: 'WebGLRenderer',
    mount,
  });
  status.textContent = `WebGL benchmark complete: ${result.approximateFpsFromRaf} fps from RAF cadence. Re-run with window.runLoom3Benchmark().`;
  return result;
}

window.runLoom3Benchmark = run;

run().catch((error) => {
  status.textContent = 'WebGL benchmark failed. Open the browser console for details.';
  console.error('[Loom3 renderer benchmark] WebGL benchmark failed', error);
});
