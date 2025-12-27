import React, { useState, useEffect, useRef, memo } from 'react';
import {
  VStack,
  HStack,
  Slider,
  Text,
  Badge,
  Box,
  Switch,
} from '@chakra-ui/react';
import DockableAccordionItem from './DockableAccordionItem';
import { useModulesContext } from '../../context/ModulesContext';

interface EyeHeadTrackingSectionProps {
  engine?: any;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

function EyeHeadTrackingSection({ engine, disabled = false, defaultExpanded = false }: EyeHeadTrackingSectionProps) {
  const { eyeHeadTrackingService } = useModulesContext();
  const [trackingMode, setTrackingMode] = useState<'manual' | 'mouse' | 'webcam'>('manual');
  const [gazeX, setGazeX] = useState(0);
  const [gazeY, setGazeY] = useState(0);
  const [webcamFaceDetected, setWebcamFaceDetected] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

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
  const [useAnimationAgency, setUseAnimationAgency] = useState(true);

  // Initialize service config on mount
  useEffect(() => {
    if (!eyeHeadTrackingService) return;

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
  }, [eyeHeadTrackingService]);

  // Subscribe to webcam face detection updates from service (only status changes)
  useEffect(() => {
    if (!eyeHeadTrackingService) return;

    const unsubscribe = eyeHeadTrackingService.subscribeToWebcam((detected) => {
      setWebcamFaceDetected(detected);

      // Attach video element when webcam becomes active
      if (detected && videoContainerRef.current) {
        const video = eyeHeadTrackingService.getWebcamVideoElement();
        if (video && !videoContainerRef.current.contains(video)) {
          video.style.width = '100%';
          video.style.borderRadius = '8px';
          video.style.transform = 'scaleX(-1)';
          video.style.backgroundColor = '#000';
          videoContainerRef.current.prepend(video);
        }
      }
    });

    return unsubscribe;
  }, [eyeHeadTrackingService]);

  const handleModeChange = (mode: 'manual' | 'mouse' | 'webcam') => {
    if (!eyeHeadTrackingService) return;
    setTrackingMode(mode);
    eyeHeadTrackingService.setMode(mode);
  };

  const handleManualGazeChange = (x: number, y: number) => {
    setGazeX(x);
    setGazeY(y);
    if (eyeHeadTrackingService && trackingMode === 'manual') {
      eyeHeadTrackingService.setGazeTarget({ x, y, z: 0 });
    }
  };

  const handleConfigChange = (config: any) => {
    eyeHeadTrackingService?.updateConfig(config);
  };

  if (!eyeHeadTrackingService) {
    return (
      <DockableAccordionItem title="Eye & Head Tracking" isDefaultExpanded={defaultExpanded}>
        <VStack align="stretch" gap={4}>
          <Text fontSize="sm" color="white">Eye/head tracking service initializing...</Text>
        </VStack>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Eye & Head Tracking" isDefaultExpanded={defaultExpanded}>
      <VStack align="stretch" gap={4}>
        {/* Mode Selection */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2} color="white">Tracking Mode</Text>
          <VStack gap={2} align="stretch">
            <HStack justify="space-between" bg={trackingMode === 'manual' ? 'blue.900' : 'gray.800'} p={2} borderRadius="md">
              <Text fontSize="sm" color={trackingMode === 'manual' ? 'blue.100' : 'gray.400'}>Manual Control</Text>
              <Switch.Root checked={trackingMode === 'manual'} onCheckedChange={(d) => d.checked && handleModeChange('manual')} size="sm" colorPalette="blue" disabled={disabled}>
                <Switch.HiddenInput />
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch.Root>
            </HStack>
            <HStack justify="space-between" bg={trackingMode === 'mouse' ? 'purple.900' : 'gray.800'} p={2} borderRadius="md">
              <Text fontSize="sm" color={trackingMode === 'mouse' ? 'purple.100' : 'gray.400'}>Track Mouse</Text>
              <Switch.Root checked={trackingMode === 'mouse'} onCheckedChange={(d) => d.checked && handleModeChange('mouse')} size="sm" colorPalette="purple" disabled={disabled}>
                <Switch.HiddenInput />
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch.Root>
            </HStack>
            <HStack justify="space-between" bg={trackingMode === 'webcam' ? 'green.900' : 'gray.800'} p={2} borderRadius="md">
              <Text fontSize="sm" color={trackingMode === 'webcam' ? 'green.100' : 'gray.400'}>Track Webcam {webcamFaceDetected && '👁️'}</Text>
              <Switch.Root checked={trackingMode === 'webcam'} onCheckedChange={(d) => d.checked && handleModeChange('webcam')} size="sm" colorPalette="green" disabled={disabled}>
                <Switch.HiddenInput />
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch.Root>
            </HStack>
          </VStack>
        </Box>

        {/* Webcam Preview */}
        {trackingMode === 'webcam' && (
          <Box>
            <HStack gap={2} mb={2}>
              <Text fontSize="sm" color="white">Face Detection:</Text>
              <Badge colorPalette={webcamFaceDetected ? 'green' : 'yellow'}>{webcamFaceDetected ? 'Detected' : 'Searching...'}</Badge>
            </HStack>
            <Box ref={videoContainerRef} position="relative" display="inline-block" width="100%" minHeight="200px" bg="black" borderRadius="md" />
            <Text fontSize="xs" color="white" mt={2}>{eyeHeadTrackingService?.isWebcamActive() ? 'Webcam active - character tracking your face' : 'Initializing webcam...'}</Text>
          </Box>
        )}

        {/* Manual Control Sliders */}
        {trackingMode === 'manual' && (
          <Box>
            <Text fontSize="sm" fontWeight="bold" mb={2} color="white">Manual Gaze Control</Text>
            <VStack gap={3} align="stretch">
              <VStack gap={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="white">Horizontal</Text>
                  <Text fontSize="xs" color="white" fontFamily="mono">{gazeX.toFixed(2)}</Text>
                </HStack>
                <Slider.Root value={[gazeX]} onValueChange={(d) => handleManualGazeChange(d.value[0], gazeY)} min={-1} max={1} step={0.01} disabled={disabled}>
                  <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
                </Slider.Root>
              </VStack>
              <VStack gap={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="white">Vertical</Text>
                  <Text fontSize="xs" color="white" fontFamily="mono">{gazeY.toFixed(2)}</Text>
                </HStack>
                <Slider.Root value={[gazeY]} onValueChange={(d) => handleManualGazeChange(gazeX, d.value[0])} min={-1} max={1} step={0.01} disabled={disabled}>
                  <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
                </Slider.Root>
              </VStack>
            </VStack>
          </Box>
        )}

        {/* Mouse Tracking Info */}
        {trackingMode === 'mouse' && (
          <Box bg="purple.900" p={3} borderRadius="md">
            <Text fontSize="sm" color="purple.100">Mouse tracking active - character follows your cursor</Text>
            <Text fontSize="xs" color="purple.200" mt={1}>Tracking continues even when drawer is closed</Text>
          </Box>
        )}

        {/* Configuration */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="white">Tracking Configuration</Text>
          <VStack gap={3} align="stretch">
            {/* Eye Tracking */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="xs" color="white">Eye Tracking</Text>
                <Switch.Root checked={eyeTrackingEnabled} onCheckedChange={(d) => { setEyeTrackingEnabled(d.checked); handleConfigChange({ eyeTrackingEnabled: d.checked }); }} size="sm" colorPalette="blue" disabled={disabled}>
                  <Switch.HiddenInput />
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch.Root>
              </HStack>
              {eyeTrackingEnabled && (
                <VStack gap={1} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="white">Eye Intensity</Text>
                    <Text fontSize="xs" color="white" fontFamily="mono">{eyeSaccadeSpeed.toFixed(2)}</Text>
                  </HStack>
                  <Slider.Root value={[eyeSaccadeSpeed]} onValueChange={(d) => { setEyeSaccadeSpeed(d.value[0]); handleConfigChange({ eyeIntensity: d.value[0] }); }} min={0} max={1} step={0.01} disabled={disabled}>
                    <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
                  </Slider.Root>
                </VStack>
              )}
            </Box>

            {/* Head Tracking */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="xs" color="white">Head Tracking</Text>
                <Switch.Root checked={headTrackingEnabled} onCheckedChange={(d) => { setHeadTrackingEnabled(d.checked); handleConfigChange({ headTrackingEnabled: d.checked }); }} size="sm" colorPalette="green" disabled={disabled}>
                  <Switch.HiddenInput />
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch.Root>
              </HStack>
              {headTrackingEnabled && (
                <VStack gap={2} align="stretch">
                  <VStack gap={1} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="white">Head Intensity</Text>
                      <Text fontSize="xs" color="white" fontFamily="mono">{headSpeed.toFixed(2)}</Text>
                    </HStack>
                    <Slider.Root value={[headSpeed]} onValueChange={(d) => { setHeadSpeed(d.value[0]); handleConfigChange({ headIntensity: d.value[0] }); }} min={0} max={1} step={0.01} disabled={disabled}>
                      <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
                    </Slider.Root>
                  </VStack>
                  <HStack justify="space-between" mt={2}>
                    <Text fontSize="xs" color="white">Head Follow Eyes</Text>
                    <Switch.Root checked={headFollowEyes} onCheckedChange={(d) => { setHeadFollowEyes(d.checked); handleConfigChange({ headFollowEyes: d.checked }); }} size="sm" colorPalette="green" disabled={disabled}>
                      <Switch.HiddenInput />
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch.Root>
                  </HStack>
                  {headFollowEyes && (
                    <VStack gap={1} align="stretch">
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="white">Head Follow Delay (ms)</Text>
                        <Text fontSize="xs" color="white" fontFamily="mono">{headFollowDelay}</Text>
                      </HStack>
                      <Slider.Root value={[headFollowDelay]} onValueChange={(d) => { setHeadFollowDelay(d.value[0]); handleConfigChange({ headFollowDelay: d.value[0] }); }} min={0} max={1000} step={50} disabled={disabled}>
                        <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
                      </Slider.Root>
                    </VStack>
                  )}
                </VStack>
              )}
            </Box>
          </VStack>
        </Box>

        {/* Blend Weights */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="white">Morph ↔ Bone Blend</Text>
          <VStack gap={3} align="stretch">
            <VStack gap={1} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="blue.200">Eyes</Text>
                <Text fontSize="xs" color="white" fontFamily="mono">{eyeBlendWeight.toFixed(2)}</Text>
              </HStack>
              <Slider.Root value={[eyeBlendWeight]} onValueChange={(d) => { setEyeBlendWeight(d.value[0]); eyeHeadTrackingService?.setEyeBlendWeight(d.value[0]); }} min={0} max={1} step={0.01} disabled={disabled || !eyeTrackingEnabled}>
                <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
              </Slider.Root>
            </VStack>
            <VStack gap={1} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="green.200">Head</Text>
                <Text fontSize="xs" color="white" fontFamily="mono">{headBlendWeight.toFixed(2)}</Text>
              </HStack>
              <Slider.Root value={[headBlendWeight]} onValueChange={(d) => { setHeadBlendWeight(d.value[0]); eyeHeadTrackingService?.setHeadBlendWeight(d.value[0]); }} min={0} max={1} step={0.01} disabled={disabled || !headTrackingEnabled}>
                <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
              </Slider.Root>
            </VStack>
          </VStack>
        </Box>

        {/* Animation Backend Toggle */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="white">Animation Backend</Text>
          <VStack gap={2} align="stretch">
            <HStack justify="space-between" bg={useAnimationAgency ? 'teal.900' : 'gray.800'} p={2} borderRadius="md">
              <VStack align="start" gap={0}>
                <Text fontSize="xs" color={useAnimationAgency ? 'teal.100' : 'gray.400'}>Animation Agency (Scheduler)</Text>
                <Text fontSize="xs" color="white">Priority blending, smooth transitions</Text>
              </VStack>
              <Switch.Root checked={useAnimationAgency} onCheckedChange={(d) => { setUseAnimationAgency(d.checked); handleConfigChange({ useAnimationAgency: d.checked }); }} size="sm" colorPalette="teal" disabled={disabled}>
                <Switch.HiddenInput />
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch.Root>
            </HStack>
          </VStack>
        </Box>

        {/* Return to Neutral */}
        <Box pt={4} borderTop="1px" borderColor="gray.700">
          <Text fontSize="sm" fontWeight="bold" mb={3} color="white">Return to Neutral</Text>
          <VStack gap={3} align="stretch">
            <HStack justify="space-between">
              <VStack align="start" gap={0}>
                <Text fontSize="xs" color="white">Auto-Return to Center</Text>
                <Text fontSize="xs" color="gray.600">Gracefully return to neutral after delay</Text>
              </VStack>
              <Switch.Root checked={returnToNeutralEnabled} onCheckedChange={(d) => { setReturnToNeutralEnabled(d.checked); handleConfigChange({ returnToNeutralEnabled: d.checked }); }} size="sm" colorPalette="cyan" disabled={disabled}>
                <Switch.HiddenInput />
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch.Root>
            </HStack>
            {returnToNeutralEnabled && (
              <VStack gap={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="white">Return Delay (ms)</Text>
                  <Text fontSize="xs" color="white" fontFamily="mono">{returnToNeutralDelay}ms</Text>
                </HStack>
                <Slider.Root value={[returnToNeutralDelay]} onValueChange={(d) => { setReturnToNeutralDelay(d.value[0]); handleConfigChange({ returnToNeutralDelay: d.value[0] }); }} min={500} max={10000} step={500} disabled={disabled}>
                  <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumb index={0} /></Slider.Control>
                </Slider.Root>
              </VStack>
            )}
          </VStack>
        </Box>

        <Box pt={2} borderTop="1px" borderColor="gray.700">
          <Text fontSize="xs" color="gray.600">Tracking mode persists when drawer closes.</Text>
        </Box>
      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(EyeHeadTrackingSection);
