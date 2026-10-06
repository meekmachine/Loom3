import * as THREE from 'three';
import { Loom3, collectMorphMeshes } from '@lovelace_lol/loom3';
import { runLoom3RendererBenchmark } from '../renderer-benchmark/shared/benchmark.js';

const mount = document.getElementById('app');
const status = document.getElementById('status');

async function createRenderer() {
  if (typeof THREE.WebGPURenderer !== 'function') {
    throw new Error('THREE.WebGPURenderer is not available from the current Three.js import map.');
  }

  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  await renderer.init();
  return renderer;
}

async function run() {
  const renderer = await createRenderer();
  status.textContent = 'WebGPU benchmark running. Open the browser console for tables.';
  const result = await runLoom3RendererBenchmark({
    THREE,
    Loom3,
    collectMorphMeshes,
    renderer,
    rendererLabel: 'WebGPURenderer',
    mount,
  });
  status.textContent = `WebGPU benchmark complete: ${result.approximateFpsFromRaf} fps from RAF cadence. Re-run with window.runLoom3Benchmark().`;
  return result;
}

window.runLoom3Benchmark = run;

run().catch((error) => {
  status.textContent = 'WebGPU benchmark failed. Open the browser console for details.';
  console.error('[Loom3 renderer benchmark] WebGPU benchmark failed', error);
});
