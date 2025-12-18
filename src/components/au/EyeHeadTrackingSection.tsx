import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  VStack,
  HStack,
  Button,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
  Badge,
  Box,
  Switch,
} from '@chakra-ui/react';
import DockableAccordionItem from './DockableAccordionItem';
import { useModulesContext } from '../../context/ModulesContext';
import { useWebcamEyeTracking } from '../../hooks/useWebcamEyeTracking';

interface EyeHeadTrackingSectionProps {
  engine?: any;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

export default function EyeHeadTrackingSection({ engine, disabled = false, defaultExpanded = false }: EyeHeadTrackingSectionProps) {
  const { eyeHeadTrackingService } = useModulesContext();
  const [trackingMode, setTrackingMode] = useState<'manual' | 'mouse' | 'webcam'>('manual');
  const [gazeX, setGazeX] = useState(0);
  const [gazeY, setGazeY] = useState(0);
  const [webcamFaceDetected, setWebcamFaceDetected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Configuration state
  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(true);
  const [headTrackingEnabled, setHeadTrackingEnabled] = useState(true);
  const [headFollowEyes, setHeadFollowEyes] = useState(true);
  const [eyeSaccadeSpeed, setEyeSaccadeSpeed] = useState(0.7);
  const [headSpeed, setHeadSpeed] = useState(0.4);
  const [headFollowDelay, setHeadFollowDelay] = useState(200);
  const [returnToNeutralEnabled, setReturnToNeutralEnabled] = useState(false);
  const [returnToNeutralDelay, setReturnToNeutralDelay] = useState(3000);
  const [eyeBlendWeight, setEyeBlendWeight] = useState(0.5);
  const [headBlendWeight, setHeadBlendWeight] = useState(0.7);
  const [followSpeed, setFollowSpeed] = useState(0.5);
  const [mouseThrottleMs, setMouseThrottleMs] = useState(100);
  const [useAnimationAgency, setUseAnimationAgency] = useState(true);

  // Initialize service config on mount to match UI state
  useEffect(() => {
    if (!eyeHeadTrackingService) return;

    // Sync initial UI state to service
    eyeHeadTrackingService.updateConfig({
      eyeTrackingEnabled,
      headTrackingEnabled,
      headFollowEyes,
      eyeIntensity: eyeSaccadeSpeed,
      headIntensity: headSpeed,
      headFollowDelay,
      returnToNeutralEnabled,
      returnToNeutralDelay,
      useAnimationAgency,
    });
    eyeHeadTrackingService.setEyeBlendWeight(eyeBlendWeight);
    eyeHeadTrackingService.setHeadBlendWeight(headBlendWeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyeHeadTrackingService]); // Only run on mount when service becomes available

  // Poll service mode to detect external changes (from Conversation Service)
  useEffect(() => {
    if (!eyeHeadTrackingService) return;

    const interval = setInterval(() => {
      const currentMode = eyeHeadTrackingService.getMode();
      if (currentMode !== trackingMode) {
        console.log(`[EyeHeadTrackingSection] Service mode changed to: ${currentMode}`);
        setTrackingMode(currentMode);
      }
    }, 100); // Poll every 100ms

    return () => clearInterval(interval);
  }, [eyeHeadTrackingService, trackingMode]);

  // Webcam tracking with landmarks processing
  const processLandmarks = useCallback((landmarks: Array<{ x: number; y: number }>, detections: any) => {
    if (!eyeHeadTrackingService || trackingMode !== 'webcam') return;

    // Draw landmarks on canvas
    if (canvasRef.current && videoRef.current && detections && detections.length > 0) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        landmarks.forEach((point, i) => {
          const x = point.x * videoRef.current!.width;
          const y = point.y * videoRef.current!.height;
          ctx.fillStyle = i === 2 ? '#00ff00' : '#ff0000';
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    }

    // BlazeFace provides 6 keypoints
    const leftEye = landmarks[0];
    const rightEye = landmarks[1];

    // Calculate gaze (average of both eyes)
    const avgX = (leftEye.x + rightEye.x) / 2;
    const avgY = (leftEye.y + rightEye.y) / 2;

    // Convert to normalized coordinates (-1 to 1)
    // NOTE: Webcam coordinates are already mirrored by the camera, so we don't negate X
    // But we DO negate Y because webcam Y is top-down (0 at top) vs our coordinate system
    const gazeX = (avgX * 2 - 1);  // No negation - webcam already mirrors horizontally
    const gazeY = -(avgY * 2 - 1); // Negate to flip Y axis

    // Apply to service
    eyeHeadTrackingService.setGazeTarget({ x: gazeX, y: gazeY, z: 0 });
    setWebcamFaceDetected(true);
  }, [eyeHeadTrackingService, trackingMode]);

  const { videoRef, state: webcamState, startTracking, stopTracking } = useWebcamEyeTracking({
    onLandmarksDetected: processLandmarks,
  });

  // Sync webcam with mode
  useEffect(() => {
    if (trackingMode === 'webcam' && !webcamState.isTracking) {
      startTracking();
    } else if (trackingMode !== 'webcam' && webcamState.isTracking) {
      stopTracking();
      setWebcamFaceDetected(false);
    }
  }, [trackingMode, webcamState.isTracking, startTracking, stopTracking]);

  // Handle mode changes from UI
  const handleModeChange = (mode: 'manual' | 'mouse' | 'webcam') => {
    if (!eyeHeadTrackingService) {
      console.warn('[EyeHeadTrackingSection] No service available');
      return;
    }

    setTrackingMode(mode);
    eyeHeadTrackingService.setMode(mode);
  };

  // Handle manual gaze control
  const handleManualGazeChange = (x: number, y: number) => {
    setGazeX(x);
    setGazeY(y);
    if (eyeHeadTrackingService && trackingMode === 'manual') {
      eyeHeadTrackingService.setGazeTarget({ x, y, z: 0 });
    }
  };

  // Handle configuration changes
  const handleConfigChange = (config: any) => {
    if (!eyeHeadTrackingService) return;
    eyeHeadTrackingService.updateConfig(config);
  };

  const handleEyeBlendChange = (value: number) => {
    setEyeBlendWeight(value);
    eyeHeadTrackingService?.setEyeBlendWeight(value);
  };

  const handleHeadBlendChange = (value: number) => {
    setHeadBlendWeight(value);
    eyeHeadTrackingService?.setHeadBlendWeight(value);
  };

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  if (!eyeHeadTrackingService) {
    return (
      <DockableAccordionItem title="Eye & Head Tracking" isDefaultExpanded={defaultExpanded}>
        <VStack align="stretch" spacing={4}>
          <Text fontSize="sm" color="gray.500">
            Eye/head tracking service initializing...
          </Text>
        </VStack>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Eye & Head Tracking" isDefaultExpanded={defaultExpanded}>
      <VStack align="stretch" spacing={4}>
        {/* Mode Selection */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2} color="gray.300">
            Tracking Mode
          </Text>
          <VStack spacing={2} align="stretch">
            <HStack justify="space-between" bg={trackingMode === 'manual' ? 'blue.900' : 'gray.800'} p={2} borderRadius="md">
              <Text fontSize="sm" color={trackingMode === 'manual' ? 'blue.100' : 'gray.400'}>
                Manual Control
              </Text>
              <Switch
                isChecked={trackingMode === 'manual'}
                onChange={(e) => e.target.checked && handleModeChange('manual')}
                size="sm"
                colorScheme="blue"
                isDisabled={disabled}
              />
            </HStack>

            <HStack justify="space-between" bg={trackingMode === 'mouse' ? 'purple.900' : 'gray.800'} p={2} borderRadius="md">
              <Text fontSize="sm" color={trackingMode === 'mouse' ? 'purple.100' : 'gray.400'}>
                Track Mouse
              </Text>
              <Switch
                isChecked={trackingMode === 'mouse'}
                onChange={(e) => e.target.checked && handleModeChange('mouse')}
                size="sm"
                colorScheme="purple"
                isDisabled={disabled}
              />
            </HStack>

            <HStack justify="space-between" bg={trackingMode === 'webcam' ? 'green.900' : 'gray.800'} p={2} borderRadius="md">
              <Text fontSize="sm" color={trackingMode === 'webcam' ? 'green.100' : 'gray.400'}>
                Track Webcam {webcamFaceDetected && '👁️'}
              </Text>
              <Switch
                isChecked={trackingMode === 'webcam'}
                onChange={(e) => e.target.checked && handleModeChange('webcam')}
                size="sm"
                colorScheme="green"
                isDisabled={disabled}
              />
            </HStack>
          </VStack>
        </Box>

        {/* Webcam Preview */}
        {trackingMode === 'webcam' && (
          <Box>
            <HStack spacing={2} mb={2}>
              <Text fontSize="sm" color="gray.300">Face Detection:</Text>
              <Badge colorScheme={webcamFaceDetected ? 'green' : 'yellow'}>
                {webcamFaceDetected ? 'Detected' : 'Searching...'}
              </Badge>
            </HStack>
            <Box position="relative" display="inline-block" width="100%">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width="640"
                height="480"
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  transform: 'scaleX(-1)',
                  backgroundColor: '#000',
                }}
              />
              <canvas
                ref={canvasRef}
                width="640"
                height="480"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  transform: 'scaleX(-1)',
                  pointerEvents: 'none',
                }}
              />
            </Box>
            <Text fontSize="xs" color="gray.500" mt={2}>
              {webcamState.isTracking
                ? 'Webcam active - character tracking your face'
                : 'Initializing webcam...'}
            </Text>
          </Box>
        )}

        {/* Manual Control Sliders */}
        {trackingMode === 'manual' && (
          <Box>
            <Text fontSize="sm" fontWeight="bold" mb={2} color="gray.300">
              Manual Gaze Control
            </Text>
            <VStack spacing={3} align="stretch">
              <VStack spacing={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.400">Horizontal</Text>
                  <Text fontSize="xs" color="gray.400" fontFamily="mono">{gazeX.toFixed(2)}</Text>
                </HStack>
                <Slider
                  value={gazeX}
                  onChange={(val) => handleManualGazeChange(val, gazeY)}
                  min={-1}
                  max={1}
                  step={0.01}
                  isDisabled={disabled}
                >
                  <SliderTrack bg="gray.700">
                    <SliderFilledTrack bg="blue.400" />
                  </SliderTrack>
                  <SliderThumb boxSize={4} bg="blue.400" />
                </Slider>
              </VStack>

              <VStack spacing={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.400">Vertical</Text>
                  <Text fontSize="xs" color="gray.400" fontFamily="mono">{gazeY.toFixed(2)}</Text>
                </HStack>
                <Slider
                  value={gazeY}
                  onChange={(val) => handleManualGazeChange(gazeX, val)}
                  min={-1}
                  max={1}
                  step={0.01}
                  isDisabled={disabled}
                >
                  <SliderTrack bg="gray.700">
                    <SliderFilledTrack bg="green.400" />
                  </SliderTrack>
                  <SliderThumb boxSize={4} bg="green.400" />
                </Slider>
              </VStack>
            </VStack>
          </Box>
        )}

        {/* Mouse Tracking Info */}
        {trackingMode === 'mouse' && (
          <Box bg="purple.900" p={3} borderRadius="md">
            <Text fontSize="sm" color="purple.100">
              Mouse tracking active - character follows your cursor
            </Text>
            <Text fontSize="xs" color="purple.200" mt={1}>
              Tracking continues even when drawer is closed
            </Text>
          </Box>
        )}

        {/* Configuration Sliders */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="gray.300">
            Tracking Configuration
          </Text>
          <VStack spacing={3} align="stretch">
            {/* Eye Tracking Toggle & Intensity */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="xs" color="gray.400">Eye Tracking</Text>
                <Switch
                  isChecked={eyeTrackingEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setEyeTrackingEnabled(enabled);
                    handleConfigChange({ eyeTrackingEnabled: enabled });
                  }}
                  size="sm"
                  colorScheme="blue"
                  isDisabled={disabled}
                />
              </HStack>
              {eyeTrackingEnabled && (
                <VStack spacing={1} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.400">Eye Intensity</Text>
                    <Text fontSize="xs" color="gray.400" fontFamily="mono">{eyeSaccadeSpeed.toFixed(2)}</Text>
                  </HStack>
                  <Slider
                    value={eyeSaccadeSpeed}
                    onChange={(val) => {
                      setEyeSaccadeSpeed(val);
                      handleConfigChange({ eyeIntensity: val });
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    isDisabled={disabled}
                  >
                    <SliderTrack bg="gray.700">
                      <SliderFilledTrack bg="blue.400" />
                    </SliderTrack>
                    <SliderThumb boxSize={4} bg="blue.400" />
                  </Slider>
                </VStack>
              )}
            </Box>

            {/* Head Tracking Toggle & Intensity */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="xs" color="gray.400">Head Tracking</Text>
                <Switch
                  isChecked={headTrackingEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setHeadTrackingEnabled(enabled);
                    handleConfigChange({ headTrackingEnabled: enabled });
                  }}
                  size="sm"
                  colorScheme="green"
                  isDisabled={disabled}
                />
              </HStack>
              {headTrackingEnabled && (
                <VStack spacing={2} align="stretch">
                  <VStack spacing={1} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.400">Head Intensity</Text>
                      <Text fontSize="xs" color="gray.400" fontFamily="mono">{headSpeed.toFixed(2)}</Text>
                    </HStack>
                    <Slider
                      value={headSpeed}
                      onChange={(val) => {
                        setHeadSpeed(val);
                        handleConfigChange({ headIntensity: val });
                      }}
                      min={0}
                      max={1}
                      step={0.01}
                      isDisabled={disabled}
                    >
                      <SliderTrack bg="gray.700">
                        <SliderFilledTrack bg="green.400" />
                      </SliderTrack>
                      <SliderThumb boxSize={4} bg="green.400" />
                    </Slider>
                  </VStack>

                  <HStack justify="space-between" mt={2}>
                    <Text fontSize="xs" color="gray.400">Head Follow Eyes</Text>
                    <Switch
                      isChecked={headFollowEyes}
                      onChange={(e) => {
                        const follow = e.target.checked;
                        setHeadFollowEyes(follow);
                        handleConfigChange({ headFollowEyes: follow });
                      }}
                      size="sm"
                      colorScheme="green"
                      isDisabled={disabled}
                    />
                  </HStack>

                  {headFollowEyes && (
                    <VStack spacing={1} align="stretch">
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.400">Head Follow Delay (ms)</Text>
                        <Text fontSize="xs" color="gray.400" fontFamily="mono">{headFollowDelay}</Text>
                      </HStack>
                      <Slider
                        value={headFollowDelay}
                        onChange={(val) => {
                          setHeadFollowDelay(val);
                          handleConfigChange({ headFollowDelay: val });
                        }}
                        min={0}
                        max={1000}
                        step={50}
                        isDisabled={disabled}
                      >
                        <SliderTrack bg="gray.700">
                          <SliderFilledTrack bg="green.400" />
                        </SliderTrack>
                        <SliderThumb boxSize={4} bg="green.400" />
                      </Slider>
                    </VStack>
                  )}
                </VStack>
              )}
            </Box>
          </VStack>
        </Box>

        {/* Follow Speed & Smoothing */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="gray.300">
            Follow Speed & Smoothing
          </Text>
          <VStack spacing={3} align="stretch">
            <VStack spacing={1} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="orange.200">Follow Speed</Text>
                <Text fontSize="xs" color="gray.400" fontFamily="mono">{followSpeed.toFixed(2)}</Text>
              </HStack>
              <Slider
                value={followSpeed}
                onChange={(val) => {
                  setFollowSpeed(val);
                  handleConfigChange({ followSpeed: val });
                }}
                min={0}
                max={1}
                step={0.05}
                isDisabled={disabled}
              >
                <SliderTrack bg="gray.700">
                  <SliderFilledTrack bg="orange.400" />
                </SliderTrack>
                <SliderThumb boxSize={4} bg="orange.400" />
              </Slider>
              <Text fontSize="xs" color="gray.500">
                0 = slow/smooth, 1 = fast/responsive
              </Text>
            </VStack>

            <VStack spacing={1} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="yellow.200">Mouse Update Rate</Text>
                <Text fontSize="xs" color="gray.400" fontFamily="mono">{mouseThrottleMs}ms</Text>
              </HStack>
              <Slider
                value={mouseThrottleMs}
                onChange={(val) => {
                  setMouseThrottleMs(val);
                  handleConfigChange({ mouseThrottleMs: val });
                }}
                min={16}
                max={250}
                step={16}
                isDisabled={disabled}
              >
                <SliderTrack bg="gray.700">
                  <SliderFilledTrack bg="yellow.400" />
                </SliderTrack>
                <SliderThumb boxSize={4} bg="yellow.400" />
              </Slider>
              <Text fontSize="xs" color="gray.500">
                Higher = fewer updates, smoother tracking
              </Text>
            </VStack>
          </VStack>
        </Box>

        {/* Morph ↔ Bone Blend */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="gray.300">
            Morph ↔ Bone Blend
          </Text>
          <VStack spacing={3} align="stretch">
            <VStack spacing={1} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="blue.200">Eyes</Text>
                <Text fontSize="xs" color="gray.400" fontFamily="mono">{eyeBlendWeight.toFixed(2)}</Text>
              </HStack>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={eyeBlendWeight}
                isDisabled={disabled || !eyeTrackingEnabled}
                onChange={handleEyeBlendChange}
              >
                <SliderTrack bg="blue.900">
                  <SliderFilledTrack bg="blue.400" />
                </SliderTrack>
                <SliderThumb boxSize={4} bg="blue.300" />
              </Slider>
              <Text fontSize="xs" color="gray.500">
                0 = bone only, 1 = bone + morph overlay
              </Text>
            </VStack>

            <VStack spacing={1} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="green.200">Head</Text>
                <Text fontSize="xs" color="gray.400" fontFamily="mono">{headBlendWeight.toFixed(2)}</Text>
              </HStack>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={headBlendWeight}
                isDisabled={disabled || !headTrackingEnabled}
                onChange={handleHeadBlendChange}
              >
                <SliderTrack bg="green.900">
                  <SliderFilledTrack bg="green.400" />
                </SliderTrack>
                <SliderThumb boxSize={4} bg="green.300" />
              </Slider>
              <Text fontSize="xs" color="gray.500">
                Adjust balance of morph overlay vs. bone rotation for head turns
              </Text>
            </VStack>
          </VStack>
        </Box>

        {/* Animation Backend Toggle */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="gray.300">
            Animation Backend
          </Text>
          <VStack spacing={2} align="stretch">
            <HStack justify="space-between" bg={useAnimationAgency ? 'teal.900' : 'gray.800'} p={2} borderRadius="md">
              <VStack align="start" spacing={0}>
                <Text fontSize="xs" color={useAnimationAgency ? 'teal.100' : 'gray.400'}>
                  Animation Agency (Scheduler)
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Priority blending, smooth transitions
                </Text>
              </VStack>
              <Switch
                isChecked={useAnimationAgency}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setUseAnimationAgency(enabled);
                  handleConfigChange({ useAnimationAgency: enabled });
                }}
                size="sm"
                colorScheme="teal"
                isDisabled={disabled}
              />
            </HStack>
            <HStack justify="space-between" bg={!useAnimationAgency ? 'orange.900' : 'gray.800'} p={2} borderRadius="md">
              <VStack align="start" spacing={0}>
                <Text fontSize="xs" color={!useAnimationAgency ? 'orange.100' : 'gray.400'}>
                  Direct Engine
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Simpler, bypasses scheduler
                </Text>
              </VStack>
              <Switch
                isChecked={!useAnimationAgency}
                onChange={(e) => {
                  const enabled = !e.target.checked;
                  setUseAnimationAgency(enabled);
                  handleConfigChange({ useAnimationAgency: enabled });
                }}
                size="sm"
                colorScheme="orange"
                isDisabled={disabled}
              />
            </HStack>
          </VStack>
        </Box>

        {/* Return to Neutral Settings */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="gray.300">
            Return to Neutral
          </Text>
          <VStack spacing={3} align="stretch">
            <HStack justify="space-between">
              <VStack align="start" spacing={0}>
                <Text fontSize="xs" color="gray.400">Auto-Return to Center</Text>
                <Text fontSize="xs" color="gray.600">Gracefully return to neutral after delay</Text>
              </VStack>
              <Switch
                isChecked={returnToNeutralEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setReturnToNeutralEnabled(enabled);
                  handleConfigChange({ returnToNeutralEnabled: enabled });
                }}
                size="sm"
                colorScheme="cyan"
                isDisabled={disabled}
              />
            </HStack>

            {returnToNeutralEnabled && (
              <VStack spacing={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.400">Return Delay (ms)</Text>
                  <Text fontSize="xs" color="gray.400" fontFamily="mono">{returnToNeutralDelay}ms</Text>
                </HStack>
                <Slider
                  value={returnToNeutralDelay}
                  onChange={(val) => {
                    setReturnToNeutralDelay(val);
                    handleConfigChange({ returnToNeutralDelay: val });
                  }}
                  min={500}
                  max={10000}
                  step={500}
                  isDisabled={disabled}
                >
                  <SliderTrack bg="gray.700">
                    <SliderFilledTrack bg="cyan.400" />
                  </SliderTrack>
                  <SliderThumb boxSize={4} bg="cyan.400" />
                </Slider>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  How long to wait before returning to center
                </Text>
              </VStack>
            )}
          </VStack>
        </Box>

        {/* Mode Persistence Note */}
        <Box pt={2} borderTop="1px" borderColor="gray.700">
          <Text fontSize="xs" color="gray.600">
            💡 Tracking mode persists when drawer closes. Conversation Service can also change modes automatically.
          </Text>
        </Box>
      </VStack>
    </DockableAccordionItem>
  );
}
