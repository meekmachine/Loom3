# Loom3 Renderer Benchmarks

These fixtures run a deterministic procedural Loom3 scene in the browser and print benchmark tables to the browser console.

## WebGPU

```bash
npm run benchmark:webgpu
```

Open the printed local URL, then open the browser console. The benchmark writes a summary table and stores the full result on:

```js
window.__loom3BenchmarkResult
```

Re-run the benchmark from the console with:

```js
window.runLoom3Benchmark()
```

The WebGPU fixture maps `three` and `three/webgpu` to the same Three.js WebGPU build so Loom3 and the renderer share one Three.js class graph.

The benchmark reports both renderer submit time and RAF interval cadence. It does not use GPU timestamp queries, so treat the numbers as browser-visible smoke/compare metrics rather than a full GPU profiler.
