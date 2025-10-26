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
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
} from '@chakra-ui/react';
import { AU_TO_MORPHS, VISEME_KEYS, AU_INFO, MIXED_AUS } from '../../engine/arkit/shapeDict';
import { useThreeState } from '../../context/threeContext';
import { EngineThree } from '../../engine/EngineThree';

export default function AUQuickPanel({
  applyAU,
  setMorph,
}: {
  applyAU?: (id: number | string, value: number) => void;
  setMorph?: (morphKey: string, value: number) => void;
}) {
  // Prefer EngineThree from context (so we use all engine-side logic),
  // but fall back to props for backward compatibility.
  const ctx = useThreeState() as any;
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

  // Local UI state for AU and viseme sliders (purely visual; writes go via engine/props)
  const [auValues, setAuValues] = useState<Record<number, number>>({});
  const [auLRValues, setAuLRValues] = useState<Record<string, number>>({});
  const [visemeValues, setVisemeValues] = useState<Record<string, number>>({});

  const auLabel = (id: number) => {
    const info = AU_INFO[String(id) as keyof typeof AU_INFO] as any;
    return info?.name ? `AU${id} — ${info.name}` : `AU${id}`;
  };

  // Unified callers: prefer engine if present, otherwise use props
  const callApplyAU = (id: number | string, v: number) => {
    if (engine) engine.setAU(id, v);
    else applyAU?.(id, v);
  };

  const callSetMorph = (key: string, v: number) => {
    if (engine) engine.setMorph(key, v);
    else setMorph?.(key, v);
  };

  const setAU = (id: number, v: number) => {
    setAuValues(prev => ({ ...prev, [id]: v }));
    callApplyAU(id, v);
  };

  const setAULR = (id: number, side: 'L' | 'R', v: number) => {
    const key = `${id}${side}`;
    setAuLRValues(prev => ({ ...prev, [key]: v }));
    callApplyAU(key, v); // EngineThree supports side notation (e.g., '12L')
  };

  const setVis = (key: string, v: number) => {
    setVisemeValues(prev => ({ ...prev, [key]: v }));
    callSetMorph(key, v);
  };

  const resetAllVisemes = () => {
    const keys = VISEME_KEYS || [];
    keys.forEach(k => callSetMorph(k, 0));
    setVisemeValues({});
  };

  returns (
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
                  {ids.map((id) => {
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
                            onChange={(v) => setAULR(id, 'L', v)}>
                            <SliderTrack><SliderFilledTrack /></SliderTrack>
                            <SliderThumb />
                          </Slider>

                          <HStack justify="space-between">
                            <Text fontSize="sm">{auLabel(id)} — Right</Text>
                            <Text fontSize="xs" opacity={0.7}>{(auLRValues[rKey] ?? 0).toFixed(2)}</Text>
                          </HStack>
                          <Slider aria-label={`au-${id}-R`} min={0} max={1} step={0.01}
                            value={auLRValues[rKey] ?? 0}
                            onChange={(v) => setAULR(id, 'R', v)}>
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
                          onChange={(v) => setAU(id, v)}>
                          <SliderTrack><SliderFilledTrack /></SliderTrack>
                          <SliderThumb />
                        </Slider>
                        {engine && MIXED_AUS.has(id) && (
                          <Box mt={2}>
                            <HStack mb={1} justify="space-between">
                              <Text fontSize="xs" opacity={0.8}>Blend (Morph ↔ Bone)</Text>
                              <Text fontSize="xs" opacity={0.6}>
                                {(engine.getAUMixWeight(id) ?? 1).toFixed(2)}
                              </Text>
                            </HStack>
                            <Slider
                              aria-label={`mix-${id}`}
                              min={0}
                              max={1}
                              step={0.01}
                              value={engine.getAUMixWeight(id) ?? 1}
                              onChange={(v) => engine.setAUMixWeight(id, v)}
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
                      onChange={(v) => setVis(key, v)}
                    >
                      <SliderTrack><SliderFilledTrack /></SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                ))}
                <HStack>
                  <Button size="sm" variant="ghost" onClick={resetAllVisemes}>Reset All Visemes</Button>
                </HStack>
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </VStack>
    </Box>
  );
}