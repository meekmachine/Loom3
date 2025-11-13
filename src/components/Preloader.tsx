import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Box } from '@chakra-ui/react';

// Global WebGL renderer to prevent multiple contexts
let globalRenderer: THREE.WebGLRenderer | null = null;

type PreloaderProps = {
  text?: string;
  progress?: number; // 0-100
  show?: boolean;
  skyboxUrl?: string; // path to skybox image
};

const Preloader: React.FC<PreloaderProps> = ({
  text = 'Loading...',
  progress = 0,
  show = true,
  skyboxUrl
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const textMeshRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const skyboxMeshRef = useRef<THREE.Mesh | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [fontLoaded, setFontLoaded] = useState(false);

  useEffect(() => {
    if (!show || !mountRef.current) return;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let textMesh: THREE.Mesh | null = null;
    let skyboxMesh: THREE.Mesh | null = null;

    // Initialize Three.js scene and camera
    scene = new THREE.Scene();
    sceneRef.current = scene;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // Reuse or create the global WebGL renderer
    if (!globalRenderer) {
      globalRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      globalRenderer.setSize(window.innerWidth, window.innerHeight);
    }

    if (mountRef.current && globalRenderer.domElement.parentNode !== mountRef.current) {
      mountRef.current.appendChild(globalRenderer.domElement);
    }

    // Load skybox if provided
    if (skyboxUrl) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        skyboxUrl,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.colorSpace = THREE.SRGBColorSpace;

          // Create a large sphere for the skybox
          const skyboxGeometry = new THREE.SphereGeometry(500, 60, 40);
          // Flip the geometry inside out
          skyboxGeometry.scale(-1, 1, 1);

          const skyboxMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
          });

          skyboxMesh = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
          scene.add(skyboxMesh);
          skyboxMeshRef.current = skyboxMesh;

          console.log('[Preloader] Skybox loaded:', skyboxUrl);
        },
        undefined,
        (error) => {
          console.error('[Preloader] Failed to load skybox:', error);
        }
      );
    }

    const loader = new FontLoader();

    // Load font and create text geometry
    loader.load(
      import.meta.env.BASE_URL + 'fonts/PressStart.json',
      (font) => {
        setFontLoaded(true);

        const displayText = progress > 0 ? `${text} ${progress}%` : text;

        const geometry = new TextGeometry(displayText, {
          font: font,
          size: 0.33,
          depth: 0.2,
          curveSegments: 12,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.02,
          bevelSegments: 5,
        });

        const material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: show ? 1.0 : 0.0,
        });

        textMesh = new THREE.Mesh(geometry, material);
        textMesh.geometry.center();
        scene.add(textMesh);

        textMeshRef.current = textMesh;

        // Animation loop
        const animate = () => {
          if (!show) return;

          animationFrameRef.current = requestAnimationFrame(animate);

          if (globalRenderer && sceneRef.current && cameraRef.current) {
            // Spin the skybox
            if (skyboxMeshRef.current) {
              skyboxMeshRef.current.rotation.y += 0.0005; // Slow rotation
            }

            // Wobble the text
            if (textMeshRef.current) {
              const time = Date.now() * 0.001;

              // Base wobble
              const wobbleX = Math.sin(time * 1.5) * 0.02;
              const wobbleY = Math.cos(time * 1.2) * 0.02;
              const wobbleZ = Math.sin(time * 0.8) * 0.01;

              // Mouse influence - amplify wobble based on mouse position
              const mouseInfluence = 0.05;
              const mouseWobbleX = mouseRef.current.x * mouseInfluence;
              const mouseWobbleY = mouseRef.current.y * mouseInfluence;

              textMeshRef.current.rotation.x = wobbleX + mouseWobbleY;
              textMeshRef.current.rotation.y = wobbleY + mouseWobbleX;
              textMeshRef.current.rotation.z = wobbleZ;

              // Subtle pulse effect
              const pulse = Math.sin(time * 2) * 0.05 + 0.95;
              textMeshRef.current.scale.setScalar(pulse);

              // Keep text in front of camera
              textMeshRef.current.position.z = 0;
            }

            globalRenderer.render(sceneRef.current, cameraRef.current);
          }
        };

        animate();
      },
      undefined,
      (error) => {
        console.error('[Preloader] Failed to load font:', error);
      }
    );

    // Mouse move handler
    const handleMouseMove = (event: MouseEvent) => {
      // Normalize mouse position to -1 to 1
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Handle window resize
    const handleResize = () => {
      if (cameraRef.current && globalRenderer) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        globalRenderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);

      // Cancel animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Cleanup: Remove renderer DOM element and dispose of objects
      if (mountRef.current && globalRenderer?.domElement && mountRef.current.contains(globalRenderer.domElement)) {
        mountRef.current.removeChild(globalRenderer.domElement);
      }

      if (textMesh) {
        textMesh.geometry.dispose();
        (textMesh.material as THREE.Material).dispose();
        if (sceneRef.current) {
          sceneRef.current.remove(textMesh);
        }
      }

      if (skyboxMesh) {
        skyboxMesh.geometry.dispose();
        (skyboxMesh.material as THREE.Material).dispose();
        if (sceneRef.current) {
          sceneRef.current.remove(skyboxMesh);
        }
      }
    };
  }, [text, progress, show, skyboxUrl]);

  // Update text when progress changes
  useEffect(() => {
    if (!fontLoaded || !textMeshRef.current || !sceneRef.current) return;

    const displayText = progress > 0 ? `${text} ${progress}%` : text;

    // Remove old text
    const oldTextMesh = textMeshRef.current;
    sceneRef.current.remove(oldTextMesh);
    oldTextMesh.geometry.dispose();

    // Create new text with updated progress
    const loader = new FontLoader();
    loader.load(
      import.meta.env.BASE_URL + 'fonts/PressStart.json',
      (font) => {
        const geometry = new TextGeometry(displayText, {
          font: font,
          size: 0.33,
          depth: 0.2,
          curveSegments: 12,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.02,
          bevelSegments: 5,
        });

        const material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1.0,
        });

        const textMesh = new THREE.Mesh(geometry, material);
        textMesh.geometry.center();

        if (sceneRef.current) {
          sceneRef.current.add(textMesh);
          textMeshRef.current = textMesh;
        }
      }
    );
  }, [progress, text, fontLoaded]);

  if (!show) return null;

  return (
    <Box
      ref={mountRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
        pointerEvents: 'all', // Allow mouse events for wobble interaction
        textAlign: 'center',
      }}
    />
  );
};

export default Preloader;
