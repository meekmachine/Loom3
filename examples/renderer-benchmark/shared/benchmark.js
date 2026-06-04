const FRAME_COUNT = 360;
const WARMUP_FRAMES = 60;
const HAIR_MORPHS = [
  'L_Hair_Left',
  'L_Hair_Right',
  'L_Hair_Front',
  'Fluffy_Right',
  'Fluffy_Bottom_ALL',
  'Hairline_High_ALL',
  'Length_Short',
];

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function summarize(values) {
  if (!values.length) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / values.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function setMorphTargets(THREE, geometry, morphNames, deltaForVertex) {
  const position = geometry.getAttribute('position');
  geometry.morphAttributes.position = morphNames.map((name) => {
    const data = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const delta = deltaForVertex(name, x, y, z);
      data[index * 3] = delta.x;
      data[index * 3 + 1] = delta.y;
      data[index * 3 + 2] = delta.z;
    }
    const attribute = new THREE.Float32BufferAttribute(data, 3);
    attribute.name = name;
    return attribute;
  });
  geometry.morphTargetsRelative = true;
}

function attachMorphDictionary(mesh, morphNames) {
  mesh.morphTargetDictionary = Object.fromEntries(morphNames.map((name, index) => [name, index]));
  mesh.morphTargetInfluences = new Array(morphNames.length).fill(0);
}

function createFaceMesh(THREE) {
  const morphNames = ['Smile', 'VisemeOpen', 'BlinkLeft', 'BlinkRight', 'BenchmarkClip'];
  const geometry = new THREE.BoxGeometry(1.4, 1.8, 0.32, 18, 24, 4);

  setMorphTargets(THREE, geometry, morphNames, (name, x, y, z) => {
    const mouthBand = Math.max(0, 1 - Math.abs(y + 0.48) * 5);
    const eyeBand = Math.max(0, 1 - Math.abs(y - 0.36) * 6);
    const side = x < 0 ? -1 : 1;

    if (name === 'Smile') {
      return { x: side * mouthBand * 0.08, y: mouthBand * 0.12, z: mouthBand * 0.04 };
    }
    if (name === 'VisemeOpen') {
      return { x: 0, y: -mouthBand * 0.18, z: mouthBand * 0.08 };
    }
    if (name === 'BlinkLeft') {
      return { x: 0, y: x < 0 ? -eyeBand * 0.12 : 0, z: 0 };
    }
    if (name === 'BlinkRight') {
      return { x: 0, y: x > 0 ? -eyeBand * 0.12 : 0, z: 0 };
    }
    return { x: Math.sin((x + y + z) * 4) * 0.035, y: 0, z: 0.06 };
  });

  const material = new THREE.MeshStandardMaterial({
    color: 0x80b8ff,
    roughness: 0.52,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Face';
  attachMorphDictionary(mesh, morphNames);
  return mesh;
}

function createHairMesh(THREE) {
  const geometry = new THREE.SphereGeometry(0.82, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  setMorphTargets(THREE, geometry, HAIR_MORPHS, (name, x, y, z) => {
    const lift = Math.max(0, y + 0.1);
    if (name === 'L_Hair_Left') return { x: -0.16 * lift, y: 0, z: 0.02 };
    if (name === 'L_Hair_Right') return { x: 0.16 * lift, y: 0, z: 0.02 };
    if (name === 'L_Hair_Front') return { x: 0, y: -0.04 * lift, z: 0.18 * lift };
    if (name === 'Fluffy_Right') return { x: 0.1 * Math.max(0, x), y: 0.08 * lift, z: 0 };
    if (name === 'Fluffy_Bottom_ALL') return { x: 0, y: -0.1 * Math.max(0, -y), z: 0.04 };
    if (name === 'Hairline_High_ALL') return { x: 0, y: 0.12 * lift, z: 0 };
    return { x: 0, y: -0.08 * lift, z: 0 };
  });

  const material = new THREE.MeshStandardMaterial({
    color: 0x222b34,
    roughness: 0.74,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Hair';
  mesh.position.y = 0.95;
  mesh.position.z = 0.03;
  attachMorphDictionary(mesh, HAIR_MORPHS);
  return mesh;
}

function createBenchmarkProfile() {
  return {
    name: 'Renderer benchmark synthetic profile',
    animalType: 'synthetic',
    auToMorphs: {
      12: { left: [], right: [], center: ['Smile'] },
      45: { left: ['BlinkLeft'], right: ['BlinkRight'], center: [] },
    },
    auToBones: {
      51: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 28 }],
      25: [{ node: 'JAW', channel: 'rx', scale: 1, maxDegrees: 18 }],
    },
    boneNodes: {
      HEAD: 'Head',
      JAW: 'Jaw',
    },
    morphToMesh: {
      face: ['Face'],
      viseme: ['Face'],
      hair: ['Hair'],
    },
    visemeKeys: ['VisemeOpen'],
    visemeSlots: [
      {
        id: 'open',
        label: 'Open',
        order: 0,
        defaultJawAmount: 0.45,
      },
    ],
    visemeBindings: {
      open: { morph: 'VisemeOpen' },
    },
    visemeMeshCategory: 'viseme',
    visemeJawAmounts: [0.45],
    meshes: {
      Hair: {
        category: 'hair',
        morphCount: HAIR_MORPHS.length,
        material: {
          renderOrder: 5,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          depthTest: true,
          blending: 'Normal',
        },
      },
    },
    compositeRotations: [
      {
        node: 'HEAD',
        pitch: null,
        yaw: { aus: [51], axis: 'ry', positive: 51 },
        roll: null,
      },
      {
        node: 'JAW',
        pitch: { aus: [25], axis: 'rx', positive: 25 },
        yaw: null,
        roll: null,
      },
    ],
    hairPhysics: {
      morphTargets: {
        swayLeft: 'L_Hair_Left',
        swayRight: 'L_Hair_Right',
        swayFront: 'L_Hair_Front',
        fluffRight: 'Fluffy_Right',
        fluffBottom: 'Fluffy_Bottom_ALL',
        headUp: {
          Hairline_High_ALL: { value: 0.45, axis: 'pitch' },
          Length_Short: { value: 0.65, axis: 'pitch' },
        },
        headDown: {
          L_Hair_Front: { value: 1.1, axis: 'pitch' },
          Fluffy_Bottom_ALL: { value: 0.8, axis: 'pitch' },
        },
      },
    },
  };
}

function createBenchmarkScene(THREE, Loom3, collectMorphMeshes) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101418);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 1.1, 5.2);
  camera.lookAt(0, 0.45, 0);

  const root = new THREE.Group();
  root.name = 'Loom3BenchmarkRoot';
  scene.add(root);

  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.y = 0.6;
  root.add(head);

  const jaw = new THREE.Bone();
  jaw.name = 'Jaw';
  jaw.position.y = -0.64;
  head.add(jaw);

  const face = createFaceMesh(THREE);
  head.add(face);

  const jawMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.28, 0.28, 8, 4, 2),
    new THREE.MeshStandardMaterial({ color: 0x5c86bd, roughness: 0.55 })
  );
  jawMesh.name = 'JawVisual';
  jawMesh.position.y = -0.62;
  jawMesh.position.z = 0.02;
  jaw.add(jawMesh);

  const hair = createHairMesh(THREE);
  head.add(hair);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.05;
  scene.add(ground);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.2, 3.5, 4.5);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  root.updateMatrixWorld(true);

  const loom = new Loom3({
    presetType: 'fish',
    profile: createBenchmarkProfile(),
  });
  loom.onReady({ model: root, meshes: collectMorphMeshes(root) });
  loom.setMeshMaterialConfig('Hair', {
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    depthTest: true,
    blending: 'Normal',
  });
  const hairRegistration = loom.registerHairObjects([hair]);

  const clip = new THREE.AnimationClip('benchmark_morph_pulse', 1.2, [
    new THREE.NumberKeyframeTrack(`${face.uuid}.morphTargetInfluences[4]`, [0, 0.6, 1.2], [0, 1, 0]),
  ]);
  loom.loadAnimationClips([clip]);
  loom.playAnimation('benchmark_morph_pulse', { loop: true });

  return {
    scene,
    camera,
    loom,
    refs: { root, head, jaw, face, hair },
    setup: {
      hairRegistrationCount: hairRegistration.length,
      morphMeshCount: collectMorphMeshes(root).length,
    },
  };
}

function resizeRenderer(renderer, camera, canvasParent) {
  const width = Math.max(320, canvasParent.clientWidth || window.innerWidth);
  const height = Math.max(240, canvasParent.clientHeight || window.innerHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function applyFrameControls(loom, frame, totalFrames) {
  const phase = frame / totalFrames;
  const wave = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  const quick = (Math.sin(phase * Math.PI * 16) + 1) / 2;

  loom.setAU(12, wave);
  loom.setAU(45, quick, Math.sin(phase * Math.PI * 4));
  loom.setAU(51, Math.sin(phase * Math.PI * 2) * 0.5 + 0.5);
  loom.setAU(25, wave);
  loom.setViseme(0, quick, 1);
  loom.setMorph('BenchmarkClip', 1 - wave, ['Face']);
  loom.update(1 / 60);
}

function collectAssertions(refs, loom) {
  const faceDict = refs.face.morphTargetDictionary || {};
  const hairDict = refs.hair.morphTargetDictionary || {};
  const headYawMagnitude = Math.abs(refs.head.quaternion.y);
  return {
    smile: refs.face.morphTargetInfluences?.[faceDict.Smile] ?? 0,
    visemeOpen: refs.face.morphTargetInfluences?.[faceDict.VisemeOpen] ?? 0,
    benchmarkClip: refs.face.morphTargetInfluences?.[faceDict.BenchmarkClip] ?? 0,
    hairLeft: refs.hair.morphTargetInfluences?.[hairDict.L_Hair_Left] ?? 0,
    headYawMagnitude,
    hairRegistered: loom.getRegisteredHairObjects().length,
    hairOpacity: Array.isArray(refs.hair.material) ? null : refs.hair.material.opacity,
  };
}

export async function runLoom3RendererBenchmark({
  THREE,
  Loom3,
  collectMorphMeshes,
  renderer,
  rendererLabel,
  mount,
  frameCount = FRAME_COUNT,
  warmupFrames = WARMUP_FRAMES,
}) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const environment = createBenchmarkScene(THREE, Loom3, collectMorphMeshes);
  resizeRenderer(renderer, environment.camera, mount);
  mount.appendChild(renderer.domElement);

  const resize = () => resizeRenderer(renderer, environment.camera, mount);
  window.addEventListener('resize', resize);

  const submitTimes = [];
  const frameIntervals = [];
  let lastFrameTime = performance.now();

  for (let frame = 0; frame < frameCount + warmupFrames; frame += 1) {
    const frameTime = await nextFrame();
    const interval = frameTime - lastFrameTime;
    lastFrameTime = frameTime;

    const submitStart = performance.now();
    applyFrameControls(environment.loom, frame, frameCount);
    renderer.render(environment.scene, environment.camera);
    const submitEnd = performance.now();

    if (frame >= warmupFrames) {
      submitTimes.push(submitEnd - submitStart);
      frameIntervals.push(interval);
    }
  }

  const submit = summarize(submitTimes);
  const intervals = summarize(frameIntervals);
  const assertions = collectAssertions(environment.refs, environment.loom);
  const result = {
    renderer: rendererLabel,
    threeRevision: THREE.REVISION,
    frames: frameCount,
    warmupFrames,
    rendererFlags: {
      isWebGPURenderer: renderer.isWebGPURenderer === true,
      isWebGLRenderer: renderer.isWebGLRenderer === true,
      backend: renderer.backend?.constructor?.name || null,
    },
    setup: environment.setup,
    submitMs: Object.fromEntries(Object.entries(submit).map(([key, value]) => [key, round(value)])),
    rafIntervalMs: Object.fromEntries(Object.entries(intervals).map(([key, value]) => [key, round(value)])),
    approximateFpsFromRaf: round(1000 / intervals.avg),
    assertions: Object.fromEntries(Object.entries(assertions).map(([key, value]) => [
      key,
      typeof value === 'number' ? round(value) : value,
    ])),
    rendererInfo: renderer.info ? JSON.parse(JSON.stringify(renderer.info)) : null,
    note: 'submitMs measures JS plus renderer submit time. rafIntervalMs is the browser frame cadence; neither is a GPU timestamp query.',
  };

  window.removeEventListener('resize', resize);
  window.__loom3BenchmarkResult = result;

  console.group(`[Loom3 renderer benchmark] ${rendererLabel}`);
  console.table([
    { metric: 'frames', value: result.frames },
    { metric: 'warmupFrames', value: result.warmupFrames },
    { metric: 'threeRevision', value: result.threeRevision },
    { metric: 'isWebGPURenderer', value: result.rendererFlags.isWebGPURenderer },
    { metric: 'isWebGLRenderer', value: result.rendererFlags.isWebGLRenderer },
    { metric: 'backend', value: result.rendererFlags.backend },
    { metric: 'approxFpsFromRaf', value: result.approximateFpsFromRaf },
  ]);
  console.table([
    { metric: 'submit.avgMs', value: result.submitMs.avg },
    { metric: 'submit.p95Ms', value: result.submitMs.p95 },
    { metric: 'submit.p99Ms', value: result.submitMs.p99 },
    { metric: 'submit.maxMs', value: result.submitMs.max },
    { metric: 'raf.avgMs', value: result.rafIntervalMs.avg },
    { metric: 'raf.p95Ms', value: result.rafIntervalMs.p95 },
    { metric: 'raf.p99Ms', value: result.rafIntervalMs.p99 },
    { metric: 'raf.maxMs', value: result.rafIntervalMs.max },
  ]);
  console.table(result.assertions);
  console.log(result.note);
  console.log(result);
  console.groupEnd();

  return result;
}
