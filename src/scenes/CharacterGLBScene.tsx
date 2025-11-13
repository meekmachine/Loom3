import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export type CharacterReady = {
  scene: THREE.Scene;
  model: THREE.Object3D;
  meshes: THREE.Mesh[]; // meshes with morph targets (for facslib)
};

type CameraOverride = {
  position: [number, number, number];
  target: [number, number, number];
};

type Props = {
  src?: string;              // path to the .glb in /public
  autoRotate?: boolean;      // slow autorotate for idle viewing
  onReady?: (payload: CharacterReady) => void; // callback when model is loaded
  onProgress?: (progress: number) => void; // callback for loading progress (0-100)
  className?: string;        // optional class for the container div
  cameraOverride?: CameraOverride; // manually set camera for quick testing
  skyboxUrl?: string;        // path to HDR/EXR skybox file in /public
};

export default function CharacterGLBScene({
  src = '/characters/jonathan.glb',
  autoRotate = false,
  onReady,
  onProgress,
  className,
  cameraOverride,
  skyboxUrl,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    mount.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0c);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.6, 3);

    // Load skybox if provided
    if (skyboxUrl) {
      const isHDR = skyboxUrl.toLowerCase().endsWith('.hdr') || skyboxUrl.toLowerCase().endsWith('.exr');

      if (isHDR) {
        // Load HDR/EXR skybox
        const rgbeLoader = new RGBELoader();
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();

        rgbeLoader.load(
          skyboxUrl,
          (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            scene.background = envMap;
            scene.environment = envMap;
            texture.dispose();
            pmremGenerator.dispose();
            console.log('[CharacterGLBScene] HDR Skybox loaded:', skyboxUrl);
          },
          undefined,
          (error) => {
            console.error('[CharacterGLBScene] Failed to load HDR skybox:', error);
          }
        );
      } else {
        // Load regular image (JPG/PNG) skybox
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          skyboxUrl,
          (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            scene.background = texture;
            scene.environment = texture;
            console.log('[CharacterGLBScene] Image Skybox loaded:', skyboxUrl);
          },
          undefined,
          (error) => {
            console.error('[CharacterGLBScene] Failed to load image skybox:', error);
          }
        );
      }
    }

    // Lights - softer, more ambient lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.4);
    hemi.position.set(0, 10, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.3);
    dir.position.set(5, 10, 7.5);
    dir.castShadow = true;
    scene.add(dir);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;

    // Load GLB with Draco support
    const loader = new GLTFLoader();

    // Set up Draco decoder for compressed GLB files
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    loader.setDRACOLoader(dracoLoader);

    let model: THREE.Object3D | null = null;
    let raf = 0;

    loader.load(
      src,
      gltf => {
        model = gltf.scene;
        scene.add(model);

        // Center & scale to a reasonable size
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        model.position.x += -center.x;
        model.position.y += -center.y;
        model.position.z += -center.z;

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const desiredMax = 1.6; // ~avatar height in scene units
        const scale = desiredMax / maxDim;
        model.scale.setScalar(scale);

        // Recompute after scale
        const box2 = new THREE.Box3().setFromObject(model);
        box2.getSize(size);

        if (cameraOverride) {
          const [px, py, pz] = cameraOverride.position;
          const [tx, ty, tz] = cameraOverride.target;
          camera.position.set(px, py, pz);
          controls.target.set(tx, ty, tz);
          controls.update();
        } else {
          // Head-focused framing: aim target ~35% up from model origin
          const targetY = size.y * 0.35;
          controls.target.set(0, targetY, 0);

          // Compute distance so ~60% of model height fills vertical FOV
          const fitHeight = size.y * 0.6;
          const fov = camera.fov * Math.PI / 180;
          const dist = (fitHeight / 2) / Math.tan(fov / 2) * 1.15; // small margin
          camera.position.set(0, targetY, dist);
          controls.update();
        }

        // Collect meshes that have morph targets
        const meshes: THREE.Mesh[] = [];
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            if (Array.isArray(m.morphTargetInfluences) && m.morphTargetInfluences.length > 0) {
              meshes.push(m);
            }
          }
        });

        // DEBUG: Log raw GLB structure for Character Creator inspection
        console.group('🔍 [CharacterGLBScene] RAW GLB MODEL LOADED');
        console.log('GLTF object:', gltf);
        console.log('Model root:', model);

        // Log all bones from skeleton
        console.group('📋 SKELETON BONES');
        const allBones: THREE.Bone[] = [];
        model.traverse((obj) => {
          if ((obj as any).isBone) {
            allBones.push(obj as THREE.Bone);
          }
        });
        console.log(`Total bones found: ${allBones.length}`);

        // Categorize bones
        const jawBones = allBones.filter(b => /jaw/i.test(b.name));
        const headBones = allBones.filter(b => /head|neck/i.test(b.name));
        const eyeBones = allBones.filter(b => /eye/i.test(b.name));

        if (jawBones.length) {
          console.log('🦴 JAW BONES:', jawBones.map(b => b.name));
          console.log('🦴 JAW BONE OBJECTS:', jawBones);
        } else {
          console.warn('⚠️ NO JAW BONES FOUND!');
        }

        if (headBones.length) {
          console.log('🦴 HEAD/NECK BONES:', headBones.map(b => b.name));
        }

        if (eyeBones.length) {
          console.log('🦴 EYE BONES:', eyeBones.map(b => b.name));
        }

        console.log('🦴 ALL BONE NAMES:', allBones.map(b => b.name));
        console.groupEnd();

        // Log morph targets per mesh
        console.group('🎭 MORPH TARGETS (BLENDSHAPES)');
        console.log(`Total meshes with morphs: ${meshes.length}`);

        meshes.forEach((mesh, idx) => {
          const dict = (mesh as any).morphTargetDictionary;
          if (dict) {
            const allMorphNames = Object.keys(dict);

            // Categorize morphs
            const jawMorphs = allMorphNames.filter(n => /jaw/i.test(n));
            const mouthMorphs = allMorphNames.filter(n => /mouth|lip/i.test(n));
            const visemeMorphs = allMorphNames.filter(n => /^[A-Z]{1,3}$/.test(n) || /viseme/i.test(n));

            console.group(`Mesh[${idx}] "${mesh.name}" (${allMorphNames.length} morphs)`);
            console.log('morphTargetDictionary:', dict);
            console.log('morphTargetInfluences:', mesh.morphTargetInfluences);

            if (jawMorphs.length) {
              console.log('👄 JAW MORPHS:', jawMorphs);
            }
            if (mouthMorphs.length) {
              console.log('👄 MOUTH/LIP MORPHS:', mouthMorphs);
            }
            if (visemeMorphs.length) {
              console.log('🗣️ VISEME MORPHS:', visemeMorphs);
            }

            console.log('📝 ALL MORPH NAMES (alphabetical):', allMorphNames.sort());
            console.groupEnd();
          }
        });
        console.groupEnd();

        console.log('✅ Model loading complete - check logs above for bone/morph names');
        console.groupEnd();

        onReady?.({ scene, model, meshes });
      },
      (progressEvent) => {
        // Calculate loading progress percentage
        if (progressEvent.lengthComputable) {
          const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress?.(Math.round(percentComplete));
        }
      },
      (err) => {
        console.error(`Failed to load ${src}. Place your GLB under public/`, err);
      }
    );

    const clock = new THREE.Clock();
    const animate = () => {
      const dt = clock.getDelta();
      if (autoRotate && model) model.rotation.y += 0.2 * dt;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (model) scene.remove(model);
      controls.dispose();
      renderer.dispose();
      dracoLoader.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [src, autoRotate, onReady, onProgress, cameraOverride, skyboxUrl]);

  return <div ref={mountRef} className={className} />;
}