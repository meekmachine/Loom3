import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EngineWind } from '../engine/EngineWind';
import { HairService } from '../latticework/hair/hairService';

export type CharacterReady = {
  scene: THREE.Scene;
  model: THREE.Object3D;
  meshes: THREE.Mesh[]; // meshes with morph targets (for facslib)
  windEngine?: EngineWind; // wind physics engine for hair
  hairService?: HairService; // hair customization service
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
    let windEngine: EngineWind | null = null;
    let hairService: HairService | null = null;
    let raf = 0;
    let loadingTextMesh: THREE.Mesh | null = null;
    let mousePos = { x: 0, y: 0 };

    // Mouse tracking for text wobble
    const handleMouseMove = (event: MouseEvent) => {
      mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Create 3D loading text
    const fontLoader = new FontLoader();
    fontLoader.load(
      import.meta.env.BASE_URL + 'fonts/helvetiker_bold.typeface.json',
      (font) => {
        const textGeometry = new TextGeometry('Loading Model', {
          font: font,
          size: 0.08, // Much smaller text
          depth: 0.01, // Very thin
          curveSegments: 4,
          bevelEnabled: true,
          bevelThickness: 0.003,
          bevelSize: 0.002,
          bevelSegments: 2,
        });

        const textMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1.0,
        });

        loadingTextMesh = new THREE.Mesh(textGeometry, textMaterial);
        textGeometry.center();
        loadingTextMesh.position.set(0, 1.8, 0); // Position above where head will be
        scene.add(loadingTextMesh);
      },
      undefined,
      (error) => {
        console.error('[CharacterGLBScene] Failed to load font:', error);
      }
    );

    // Function to update loading text with progress
    const updateLoadingText = (progress: number) => {
      if (!loadingTextMesh) return;

      // Remove old text
      scene.remove(loadingTextMesh);
      loadingTextMesh.geometry.dispose();
      (loadingTextMesh.material as THREE.Material).dispose();

      // Create new text with progress
      fontLoader.load(
        import.meta.env.BASE_URL + 'fonts/helvetiker_bold.typeface.json',
        (font) => {
          const textGeometry = new TextGeometry(`Loading ${progress}%`, {
            font: font,
            size: 0.08, // Much smaller text
            depth: 0.01, // Very thin
            curveSegments: 4,
            bevelEnabled: true,
            bevelThickness: 0.003,
            bevelSize: 0.002,
            bevelSegments: 2,
          });

          const textMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
          });

          loadingTextMesh = new THREE.Mesh(textGeometry, textMaterial);
          textGeometry.center();
          loadingTextMesh.position.set(0, 1.8, 0); // Position above where head will be
          scene.add(loadingTextMesh);
        }
      );
    };

    loader.load(
      src,
      gltf => {
        model = gltf.scene;
        scene.add(model);

        // ============================================
        // HAIR DETECTION & SERVICE INITIALIZATION
        // ============================================
        // Automatically detect hair and eyebrow objects in the loaded model
        // Searches for objects with names containing: hair, bushy, side_part, eyebrow
        const hairObjects: THREE.Object3D[] = [];

        model.traverse((obj) => {
          const nameLower = obj.name.toLowerCase();
          if (nameLower.includes('hair') ||
              nameLower.includes('bushy') ||
              nameLower.includes('side_part') ||
              nameLower.includes('sidepart') ||
              nameLower.includes('eyebrow') ||
              nameLower === 'male_bushy' ||
              nameLower === 'side_part_wavy') {
            hairObjects.push(obj);
          }
        });

        // Initialize hair customization service if hair objects were found
        if (hairObjects.length > 0) {
          hairService = new HairService();
          hairService.registerObjects(hairObjects);
        }

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

        // Initialize wind physics engine for hair
        windEngine = new EngineWind(model);
        if (windEngine.getHairBoneCount() > 0) {
          console.log(`[CharacterGLBScene] Wind engine initialized with ${windEngine.getHairBoneCount()} hair bones:`,
            windEngine.getHairBoneNames());
        } else {
          console.log('[CharacterGLBScene] No hair bones detected - wind physics disabled');
        }

        // Remove loading text when model is ready
        if (loadingTextMesh) {
          scene.remove(loadingTextMesh);
          loadingTextMesh.geometry.dispose();
          (loadingTextMesh.material as THREE.Material).dispose();
          loadingTextMesh = null;
        }

        onReady?.({ scene, model, meshes, windEngine: windEngine, hairService: hairService || undefined });
      },
      (progressEvent) => {
        // Calculate loading progress percentage
        if (progressEvent.lengthComputable) {
          const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
          const roundedProgress = Math.round(percentComplete);

          // Update 3D loading text with progress
          updateLoadingText(roundedProgress);

          // Also call the onProgress callback
          onProgress?.(roundedProgress);
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

      // Update wind physics
      if (windEngine) {
        windEngine.update(dt);
      }

      // Animate loading text with wobble
      if (loadingTextMesh) {
        const time = Date.now() * 0.001;

        // Base wobble
        const wobbleX = Math.sin(time * 1.5) * 0.02;
        const wobbleY = Math.cos(time * 1.2) * 0.02;
        const wobbleZ = Math.sin(time * 0.8) * 0.01;

        // Mouse influence
        const mouseInfluence = 0.05;
        const mouseWobbleX = mousePos.x * mouseInfluence;
        const mouseWobbleY = mousePos.y * mouseInfluence;

        loadingTextMesh.rotation.x = wobbleX + mouseWobbleY;
        loadingTextMesh.rotation.y = wobbleY + mouseWobbleX;
        loadingTextMesh.rotation.z = wobbleZ;

        // Subtle pulse effect
        const pulse = Math.sin(time * 2) * 0.05 + 0.95;
        loadingTextMesh.scale.setScalar(pulse);
      }

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
      window.removeEventListener('mousemove', handleMouseMove);

      // Clean up loading text if still present
      if (loadingTextMesh) {
        scene.remove(loadingTextMesh);
        loadingTextMesh.geometry.dispose();
        (loadingTextMesh.material as THREE.Material).dispose();
      }

      // Clean up hair service
      if (hairService) {
        hairService.dispose();
      }

      if (model) scene.remove(model);
      controls.dispose();
      renderer.dispose();
      dracoLoader.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [src, autoRotate, onReady, onProgress, cameraOverride, skyboxUrl]);

  return <div ref={mountRef} className={className} />;
}