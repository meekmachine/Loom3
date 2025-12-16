import React, { useMemo, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Switch,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { AU_TO_MORPHS, VISEME_KEYS, AU_INFO } from '../../engine/arkit/shapeDict';
import { useEngineState } from '../../context/engineContext';
import { EngineThree, MIXED_AUS } from '../../engine/EngineThree';
import { CurveEditor } from '../CurveEditor';

export default function AUQuickPanel() {
  // Get EngineThree from context (all blendshape/boneshape logic lives there)
  const ctx = useEngineState() as any;
  const engine: EngineThree | undefined = ctx?.engine;

  // All AU ids present in ShapeDict (sorted)
  const auIds = useMemo(() => Object.keys(AU_TO_MORPHS).map(Number).sort((a, b) => a - b), []);

  // Group AUs by facePart metadata (fallback to faceSection, then Other)
  type Groups = Record<string, number[]>;
  const groupedAUs: Groups = useMemo(() => {
    const g: Groups = {};
    for (const id of auIds) {
      const info = AU_INFO[String(id) as keyof typeof AU_INFO] as any;
      const part: string = (info?.facePart as string) || (info?.faceSection as string) || 'Other';
      if (!g[part]) g[part] = [];
      g[part].push(id);
    }
    Object.values(g).forEach(arr => arr.sort((a, b) => a - b));
    return g;
  }, [auIds]);

  const SECTION_ORDER = [
    'Forehead', 'Brow', 'Brow area', 'Eyelids', 'Eyes', 'Nose', 'Cheeks', 'Mouth', 'Chin', 'Jaw', 'Head', 'Tongue', 'Other'
  ];

  const orderedSections = useMemo(() => {
    const entries = Object.entries(groupedAUs);
    return entries.sort((a, b) => {
      const ia = SECTION_ORDER.indexOf(a[0]);
      const ib = SECTION_ORDER.indexOf(b[0]);
      const sa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
      const sb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
      if (sa !== sb) return sa - sb;
      return a[0].localeCompare(b[0]);
    });
  }, [groupedAUs]);

  // Local UI state for AU and viseme sliders (purely visual; writes go via engine)
  const [auValues, setAuValues] = useState<Record<number, number>>({});
  const [auLRValues, setAuLRValues] = useState<Record<string, number>>({});
  const [visemeValues, setVisemeValues] = useState<Record<string, number>>({});
  // Combined continuum for eyes (horizontal: -1..1, vertical: -1..1)
  const [eyeH, setEyeH] = useState<number>(0);
  const [eyeV, setEyeV] = useState<number>(0);
  // Individual-eye continua
  const [eyeLH, setEyeLH] = useState<number>(0);
  const [eyeLV, setEyeLV] = useState<number>(0);
  const [eyeRH, setEyeRH] = useState<number>(0);
  const [eyeRV, setEyeRV] = useState<number>(0);
  // Combined continuum for head (horizontal: -1..1, vertical: -1..1)
  const [headH, setHeadH] = useState<number>(0);
  const [headV, setHeadV] = useState<number>(0);
  // Combined continuum for head tilt/roll (left↔right)
  const [headR, setHeadR] = useState<number>(0);

  /**
   * Helper to apply a continuum value (-1 to +1) to a pair of AUs.
   * Calls engine.setAU for both the negative and positive AU.
   */
  const applyContinuum = (negAU: number, posAU: number, value: number) => {
    if (value >= 0) {
      engine?.setAU(posAU, value);
      engine?.setAU(negAU, 0);
    } else {
      engine?.setAU(negAU, -value);
      engine?.setAU(posAU, 0);
    }
  };

  // Local state for Morph↔Bone blend sliders (so Chakra's Slider is controlled)
  const [mixValues, setMixValues] = useState<Record<number, number>>({});
  const getMix = (id: number) => (mixValues[id] ?? engine?.getAUMixWeight(id) ?? 1);
  const setMix = (id: number, v: number) => {
    setMixValues(prev => ({ ...prev, [id]: v }));
    engine?.setAUMixWeight(id, v);
  };

  // Toggle between sliders and curve editors
  const [useCurveEditor, setUseCurveEditor] = useState<boolean>(false);

  // Keyframe data for curve editors (keyed by AU id)
  const [keyframeData, setKeyframeData] = useState<Record<string, Array<{ time: number; value: number }>>>({});

  const auLabel = (id: number) => {
    const info = AU_INFO[String(id) as keyof typeof AU_INFO] as any;
    return info?.name ? `AU${id} — ${info.name}` : `AU${id}`;
  };

  // Get keyframes for an AU (default to empty array)
  const getKeyframes = (id: number | string) => {
    const key = String(id);
    return keyframeData[key] || [];
  };

  // Update keyframes for an AU
  const updateKeyframes = (id: number | string, keyframes: Array<{ time: number; value: number }>) => {
    const key = String(id);
    setKeyframeData(prev => ({ ...prev, [key]: keyframes }));
    if (keyframes.length > 0) {
      engine?.setAU(id, keyframes[0].value);
    }
  };

  return  (
    <Box
      position="fixed"
      top="12px"
      left="12px"
      zIndex={10}
      bg="rgba(0,0,0,0.6)"
      color="white"
      p={3}
      rounded="md"
      shadow="md"
      w="400px"
      maxH="85vh"
      overflowY="auto"
    >
      <VStack align="stretch" spacing={3}>
        <Text fontSize="sm" opacity={0.9}>Facial Action Units (from ShapeDict)</Text>

        <Accordion allowMultiple defaultIndex={[0]}>
          {/* AU sections grouped by facePart */}
          {orderedSections.map(([section, ids]) => (
            <AccordionItem key={section} borderColor="rgba(255,255,255,0.15)">
              <h2>
                <AccordionButton _expanded={{ bg: 'rgba(255,255,255,0.06)' }}>
                  <Box as="span" flex="1" textAlign="left" fontSize="sm">{section}</Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <VStack align="stretch" spacing={4}>
                  {/* Special combined controls for Eyes: horizontal and vertical as single continua */}
                  {section === 'Eyes' && (
                    <VStack align="stretch" spacing={3}>
                      <Box>
                        <HStack mb={1} justify="space-between">
                          <Text fontSize="sm">Eyes — Horizontal (L ⟷ R)</Text>
                          <Text fontSize="xs" opacity={0.7}>{eyeH.toFixed(2)}</Text>
                        </HStack>
                        <Slider aria-label="eyes-horizontal" min={-1} max={1} step={0.01}
                          value={eyeH}
                          onChange={(v) => { setEyeH(v); applyContinuum(61, 62, v); }}>
                          <SliderTrack><SliderFilledTrack /></SliderTrack>
                          <SliderThumb />
                        </Slider>
                      </Box>
                      <Box>
                        <HStack mb={1} justify="space-between">
                          <Text fontSize="sm">Eyes — Vertical (Down ⟷ Up)</Text>
                          <Text fontSize="xs" opacity={0.7}>{eyeV.toFixed(2)}</Text>
                        </HStack>
                        <Slider aria-label="eyes-vertical" min={-1} max={1} step={0.01}
                          value={eyeV}
                          onChange={(v) => { setEyeV(v); applyContinuum(64, 63, v); }}>
                          <SliderTrack><SliderFilledTrack /></SliderTrack>
                          <SliderThumb />
                        </Slider>
                      </Box>
                      {/* Individual-eye controls */}
                      <Box pt={2} borderTop="1px dashed rgba(255,255,255,0.15)">
                        <Text fontSize="xs" opacity={0.8} mb={2}>Left Eye (individual)</Text>
                        <VStack align="stretch" spacing={2}>
                          <HStack mb={1} justify="space-between">
                            <Text fontSize="xs">Left — Horizontal</Text>
                            <Text fontSize="xs" opacity={0.7}>{eyeLH.toFixed(2)}</Text>
                          </HStack>
                          <Slider aria-label="left-eye-horizontal" min={-1} max={1} step={0.01} value={eyeLH} onChange={(v) => { setEyeLH(v); applyContinuum(65, 66, v); }}>
                            <SliderTrack><SliderFilledTrack /></SliderTrack><SliderThumb />
                          </Slider>
                          <HStack mt={2} mb={1} justify="space-between">
                            <Text fontSize="xs">Left — Vertical</Text>
                            <Text fontSize="xs" opacity={0.7}>{eyeLV.toFixed(2)}</Text>
                          </HStack>
                          <Slider aria-label="left-eye-vertical" min={-1} max={1} step={0.01} value={eyeLV} onChange={(v) => { setEyeLV(v); applyContinuum(68, 67, v); }}>
                            <SliderTrack><SliderFilledTrack /></SliderTrack><SliderThumb />
                          </Slider>
                        </VStack>
                      </Box>
                      <Box pt={2}>
                        <Text fontSize="xs" opacity={0.8} mb={2}>Right Eye (individual)</Text>
                        <VStack align="stretch" spacing={2}>
                          <HStack mb={1} justify="space-between">
                            <Text fontSize="xs">Right — Horizontal</Text>
                            <Text fontSize="xs" opacity={0.7}>{eyeRH.toFixed(2)}</Text>
                          </HStack>
                          <Slider aria-label="right-eye-horizontal" min={-1} max={1} step={0.01} value={eyeRH} onChange={(v) => { setEyeRH(v); applyContinuum(69, 70, v); }}>
                            <SliderTrack><SliderFilledTrack /></SliderTrack><SliderThumb />
                          </Slider>
                          <HStack mt={2} mb={1} justify="space-between">
                            <Text fontSize="xs">Right — Vertical</Text>
                            <Text fontSize="xs" opacity={0.7}>{eyeRV.toFixed(2)}</Text>
                          </HStack>
                          <Slider aria-label="right-eye-vertical" min={-1} max={1} step={0.01} value={eyeRV} onChange={(v) => { setEyeRV(v); applyContinuum(72, 71, v); }}>
                            <SliderTrack><SliderFilledTrack /></SliderTrack><SliderThumb />
                          </Slider>
                        </VStack>
                      </Box>
                      {/* Eyes Morph↔Bone blend sliders */}
                      {engine && (
                        <Box pt={2} borderTop="1px solid rgba(255,255,255,0.12)">
                          <VStack align="stretch" spacing={2} mt={2}>
                            <HStack mb={1} justify="space-between">
                              <Text fontSize="xs" opacity={0.8}>Eyes — Horizontal Blend (Morph ↔ Bone)</Text>
                              <Text fontSize="xs" opacity={0.6}>
                                {getMix(61).toFixed(2)}
                              </Text>
                            </HStack>
                            <Slider
                              aria-label="mix-eyes-horizontal"
                              min={0}
                              max={1}
                              step={0.01}
                              value={getMix(61)}
                              onChange={(v) => setMix(61, v)}
                            >
                              <SliderTrack><SliderFilledTrack /></SliderTrack>
                              <SliderThumb />
                            </Slider>
                            <HStack mb={1} justify="space-between" mt={2}>
                              <Text fontSize="xs" opacity={0.8}>Eyes — Vertical Blend (Morph ↔ Bone)</Text>
                              <Text fontSize="xs" opacity={0.6}>
                                {getMix(63).toFixed(2)}
                              </Text>
                            </HStack>
                            <Slider
                              aria-label="mix-eyes-vertical"
                              min={0}
                              max={1}
                              step={0.01}
                              value={getMix(63)}
                              onChange={(v) => setMix(63, v)}
                            >
                              <SliderTrack><SliderFilledTrack /></SliderTrack>
                              <SliderThumb />
                            </Slider>
                          </VStack>
                        </Box>
                      )}
                    </VStack>
                  )}
                  {/* Special combined controls for Head: horizontal and vertical as single continua */}
                  {section === 'Head' && (
                    <VStack align="stretch" spacing={3}>
                      <Box>
                        <HStack mb={1} justify="space-between">
                          <Text fontSize="sm">Head — Horizontal (L ⟷ R)</Text>
                          <Text fontSize="xs" opacity={0.7}>{headH.toFixed(2)}</Text>
                        </HStack>
                        <Slider aria-label="head-horizontal" min={-1} max={1} step={0.01}
                          value={headH}
                          onChange={(v) => { setHeadH(v); applyContinuum(31, 32, v); }}>
                          <SliderTrack><SliderFilledTrack /></SliderTrack>
                          <SliderThumb />
                        </Slider>
                      </Box>
                      <Box>
                        <HStack mb={1} justify="space-between">
                          <Text fontSize="sm">Head — Vertical (Down ⟷ Up)</Text>
                          <Text fontSize="xs" opacity={0.7}>{headV.toFixed(2)}</Text>
                        </HStack>
                        <Slider aria-label="head-vertical" min={-1} max={1} step={0.01}
                          value={headV}
                          onChange={(v) => { setHeadV(v); applyContinuum(54, 33, v); }}>
                          <SliderTrack><SliderFilledTrack /></SliderTrack>
                          <SliderThumb />
                        </Slider>
                      </Box>
                      <Box>
                        <HStack mb={1} justify="space-between">
                          <Text fontSize="sm">Head — Tilt (L ⟷ R)</Text>
                          <Text fontSize="xs" opacity={0.7}>{headR.toFixed(2)}</Text>
                        </HStack>
                        <Slider aria-label="head-tilt" min={-1} max={1} step={0.01}
                          value={headR}
                          onChange={(v) => { setHeadR(v); applyContinuum(55, 56, v); }}>
                          <SliderTrack><SliderFilledTrack /></SliderTrack>
                          <SliderThumb />
                        </Slider>
                      </Box>
                      {/* Head Morph↔Bone blend sliders (use base ids for axes) */}
                      {engine && (
                        <Box pt={2} borderTop="1px solid rgba(255,255,255,0.12)">
                          <VStack align="stretch" spacing={2} mt={2}>
                            <HStack mb={1} justify="space-between">
                              <Text fontSize="xs" opacity={0.8}>Head — Horizontal Blend (Morph ↔ Bone)</Text>
                              <Text fontSize="xs" opacity={0.6}>{getMix(31).toFixed(2)}</Text>
                            </HStack>
                            <Slider
                              aria-label="mix-head-horizontal"
                              min={0}
                              max={1}
                              step={0.01}
                              value={getMix(31)}
                              onChange={(v) => setMix(31, v)}
                            >
                              <SliderTrack><SliderFilledTrack /></SliderTrack>
                              <SliderThumb />
                            </Slider>
                            <HStack mb={1} justify="space-between" mt={2}>
                              <Text fontSize="xs" opacity={0.8}>Head — Vertical Blend (Morph ↔ Bone)</Text>
                              <Text fontSize="xs" opacity={0.6}>{getMix(33).toFixed(2)}</Text>
                            </HStack>
                            <Slider
                              aria-label="mix-head-vertical"
                              min={0}
                              max={1}
                              step={0.01}
                              value={getMix(33)}
                              onChange={(v) => setMix(33, v)}
                            >
                              <SliderTrack><SliderFilledTrack /></SliderTrack>
                              <SliderThumb />
                            </Slider>
                            <HStack mb={1} justify="space-between" mt={2}>
                              <Text fontSize="xs" opacity={0.8}>Head — Tilt Blend (Morph ↔ Bone)</Text>
                              <Text fontSize="xs" opacity={0.6}>{getMix(55).toFixed(2)}</Text>
                            </HStack>
                            <Slider
                              aria-label="mix-head-tilt"
                              min={0}
                              max={1}
                              step={0.01}
                              value={getMix(55)}
                              onChange={(v) => setMix(55, v)}
                            >
                              <SliderTrack><SliderFilledTrack /></SliderTrack>
                              <SliderThumb />
                            </Slider>
                          </VStack>
                        </Box>
                      )}
                    </VStack>
                  )}
                  {ids
                    .filter((id) => !(
                      (section === 'Eyes' && (id === 61 || id === 62 || id === 63 || id === 64)) ||
                      (section === 'Head' && (id === 31 || id === 32 || id === 33 || id === 54 || id === 55 || id === 56))
                    ))
                    .map((id) => {
                    const keys = AU_TO_MORPHS[id] || [];
                    const hasL = keys.some(k => /(^|_)L$/.test(k));
                    const hasR = keys.some(k => /(^|_)R$/.test(k));
                    const globalAUs = new Set([31, 32, 33, 54, 61, 62, 63, 64]);
                    if (!globalAUs.has(id) && (hasL || hasR)) {
                      const lKey = `${id}L`;
                      const rKey = `${id}R`;
                      return (
                        <VStack key={id} align="stretch" spacing={2}>
                          <HStack justify="space-between">
                            <Text fontSize="sm">{auLabel(id)} — Left</Text>
                            <Text fontSize="xs" opacity={0.7}>{(auLRValues[lKey] ?? 0).toFixed(2)}</Text>
                          </HStack>
                          <Slider aria-label={`au-${id}-L`} min={0} max={1} step={0.01}
                            value={auLRValues[lKey] ?? 0}
                            onChange={(v) => { setAuLRValues(prev => ({ ...prev, [lKey]: v })); engine?.setAU(`${id}L`, v); }}>
                            <SliderTrack><SliderFilledTrack /></SliderTrack>
                            <SliderThumb />
                          </Slider>

                          <HStack justify="space-between">
                            <Text fontSize="sm">{auLabel(id)} — Right</Text>
                            <Text fontSize="xs" opacity={0.7}>{(auLRValues[rKey] ?? 0).toFixed(2)}</Text>
                          </HStack>
                          <Slider aria-label={`au-${id}-R`} min={0} max={1} step={0.01}
                            value={auLRValues[rKey] ?? 0}
                            onChange={(v) => { setAuLRValues(prev => ({ ...prev, [rKey]: v })); engine?.setAU(`${id}R`, v); }}>
                            <SliderTrack><SliderFilledTrack /></SliderTrack>
                            <SliderThumb />
                          </Slider>
                        </VStack>
                      );
                    }

                    // Fallback: single (both sides) slider
                    return (
                      <Box key={id}>
                        <HStack mb={1} justify="space-between">
                          <Text fontSize="sm">{auLabel(id)}</Text>
                          <Text fontSize="xs" opacity={0.7}>{(auValues[id] ?? 0).toFixed(2)}</Text>
                        </HStack>
                        <Slider aria-label={`au-${id}`} min={0} max={1} step={0.01}
                          value={auValues[id] ?? 0}
                          onChange={(v) => { setAuValues(prev => ({ ...prev, [id]: v })); engine?.setAU(id, v); }}>
                          <SliderTrack><SliderFilledTrack /></SliderTrack>
                          <SliderThumb />
                        </Slider>
                        {engine && MIXED_AUS.has(id) && (
                          <Box mt={2}>
                            <HStack mb={1} justify="space-between">
                              <Text fontSize="xs" opacity={0.8}>Blend (Morph ↔ Bone)</Text>
                              <Text fontSize="xs" opacity={0.6}>
                                {getMix(id).toFixed(2)}
                              </Text>
                            </HStack>
                            <Slider
                              aria-label={`mix-${id}`}
                              min={0}
                              max={1}
                              step={0.01}
                              value={getMix(id)}
                              onChange={(v) => setMix(id, v)}
                            >
                              <SliderTrack><SliderFilledTrack /></SliderTrack>
                              <SliderThumb />
                            </Slider>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          ))}

          {/* Visemes */}
          <AccordionItem borderColor="rgba(255,255,255,0.15)">
            <h2>
              <AccordionButton _expanded={{ bg: 'rgba(255,255,255,0.06)' }}>
                <Box as="span" flex="1" textAlign="left" fontSize="sm">Visemes</Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={4}>
                {(VISEME_KEYS || []).map((key) => (
                  <Box key={key}>
                    <HStack mb={1} justify="space-between">
                      <Text fontSize="sm">{key}</Text>
                      <Text fontSize="xs" opacity={0.7}>{(visemeValues[key] ?? 0).toFixed(2)}</Text>
                    </HStack>
                    <Slider
                      aria-label={`vis-${key}`}
                      min={0}
                      max={1}
                      step={0.01}
                      value={visemeValues[key] ?? 0}
                      onChange={(v) => { setVisemeValues(prev => ({ ...prev, [key]: v })); engine?.setMorph(key, v); }}
                    >
                      <SliderTrack><SliderFilledTrack /></SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                ))}
                <HStack>
                  <Button size="sm" variant="ghost" onClick={() => {
                    VISEME_KEYS?.forEach(k => engine?.setMorph(k, 0));
                    setVisemeValues({});
                  }}>Reset All Visemes</Button>
                </HStack>
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </VStack>
    </Box>
  );
}
