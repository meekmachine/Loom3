

import React, { useRef, useState, useCallback } from 'react';
import { Box, Text, VStack, HStack } from '@chakra-ui/react';

type Keyframe = { time: number; value: number };

export interface CurveEditorProps {
  auId: number | string;
  label?: string;
  keyframes: Keyframe[];
  duration?: number; // seconds, default 2.0
  onChange?: (updated: Keyframe[]) => void;
  currentTime?: number; // current playback position in seconds
  isPlaying?: boolean; // whether this snippet is currently playing
  valueMin?: number; // minimum value for vertical axis (default 0)
  valueMax?: number; // maximum value for vertical axis (default 1)
}

const WIDTH = 400;
const HEIGHT = 180;
const MARGIN = { left: 32, right: 12, top: 18, bottom: 28 };
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const POINT_RADIUS = 7;
const HIT_RADIUS = 10;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function sortKeyframes(arr: Keyframe[]) {
  return [...arr].sort((a, b) => a.time - b.time);
}

function valueToY(value: number, min: number, max: number) {
  // value at max sits at top, min at bottom
  const range = max - min || 1;
  const norm = (value - min) / range;
  return MARGIN.top + (1 - norm) * INNER_H;
}
function yToValue(y: number, min: number, max: number) {
  const range = max - min || 1;
  const norm = 1 - (y - MARGIN.top) / INNER_H;
  return clamp(norm * range + min, min, max);
}
function timeToX(time: number, duration: number) {
  return MARGIN.left + (time / duration) * INNER_W;
}
function xToTime(x: number, duration: number) {
  return clamp((x - MARGIN.left) / INNER_W * duration, 0, duration);
}

function getPath(keyframes: Keyframe[], duration: number, min: number, max: number) {
  if (!keyframes.length) return '';
  const sorted = sortKeyframes(keyframes);
  let d = '';
  for (let i = 0; i < sorted.length; ++i) {
    const kf = sorted[i];
    const x = timeToX(kf.time, duration);
    const y = valueToY(kf.value, min, max);
    if (i === 0) d += `M ${x} ${y}`;
    else d += ` L ${x} ${y}`;
  }
  return d;
}

function nearestKeyframeIdx(
  keyframes: Keyframe[],
  x: number,
  y: number,
  duration: number,
  min: number,
  max: number
): number | null {
  // Returns index of nearest keyframe within HIT_RADIUS px, else null
  let minDist = Infinity, idx = null;
  for (let i = 0; i < keyframes.length; ++i) {
    const kf = keyframes[i];
    const kfx = timeToX(kf.time, duration);
    const kfy = valueToY(kf.value, min, max);
    const dist = Math.hypot(kfx - x, kfy - y);
    if (dist < HIT_RADIUS && dist < minDist) {
      minDist = dist;
      idx = i;
    }
  }
  return idx;
}

export const CurveEditor: React.FC<CurveEditorProps> = ({
  auId,
  label,
  keyframes,
  duration = 2.0,
  onChange,
  currentTime = 0,
  isPlaying = false,
  valueMin = 0,
  valueMax = 1,
}) => {
  // Local state for drag interaction
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Copy keyframes to local state during drag for smooth UX
  const [editing, setEditing] = useState<Keyframe[] | null>(null);
  const editingKeyframes = editing ?? keyframes;

  // Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    const idx = nearestKeyframeIdx(editingKeyframes, svgX, svgY, duration, valueMin, valueMax);
    if (e.button === 2) {
      // Right-click: delete point if near
      if (idx != null) {
        e.preventDefault();
        const next = editingKeyframes.filter((_, i) => i !== idx);
        onChange?.(sortKeyframes(next));
        setEditing(null);
      }
      return;
    }
    if (idx != null) {
      // Begin drag
      setDragIdx(idx);
      setDragOffset({ dx: svgX, dy: svgY });
      setEditing([...editingKeyframes]);
      window.addEventListener('pointermove', handlePointerMove as any);
      window.addEventListener('pointerup', handlePointerUp as any);
    } else {
      // Add keyframe at click position
      const t = clamp(xToTime(svgX, duration), 0, duration);
      const v = clamp(yToValue(svgY, valueMin, valueMax), valueMin, valueMax);
      // Don't allow duplicate t
      if (!editingKeyframes.some(kf => Math.abs(kf.time - t) < 1e-3)) {
        const next = sortKeyframes([...editingKeyframes, { time: t, value: v }]);
        onChange?.(next);
        setEditing(null);
      }
    }
  };

  // Drag move
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (dragIdx == null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    // Clamp to bounds
    const t = clamp(xToTime(svgX, duration), 0, duration);
    const v = clamp(yToValue(svgY, valueMin, valueMax), valueMin, valueMax);
    setEditing((prev) => {
      if (!prev) return null;
      // Prevent moving past neighbors
      let minT = 0, maxT = duration;
      if (dragIdx > 0) minT = prev[dragIdx - 1].time + 1e-4;
      if (dragIdx < prev.length - 1) maxT = prev[dragIdx + 1].time - 1e-4;
      const clippedT = clamp(t, minT, maxT);
      const next = prev.map((kf, i) =>
        i === dragIdx ? { ...kf, time: clippedT, value: v } : kf
      );
      return next;
    });
  }, [dragIdx, duration]);

  // Drag end
  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (dragIdx == null) return;
    setDragIdx(null);
    setDragOffset(null);
    setEditing((prev) => {
      if (!prev) return null;
      onChange?.(sortKeyframes(prev));
      return null;
    });
    window.removeEventListener('pointermove', handlePointerMove as any);
    window.removeEventListener('pointerup', handlePointerUp as any);
  }, [dragIdx, handlePointerMove, onChange]);

  // Hover effect
  const handlePointerMoveSVG = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    const idx = nearestKeyframeIdx(editingKeyframes, svgX, svgY, duration, valueMin, valueMax);
    setHoverIdx(idx);
  };
  const handlePointerLeaveSVG = () => setHoverIdx(null);

  // Context menu: prevent default to enable right-click deletion
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Axis ticks
  const xTicks = [];
  for (let i = 0; i <= duration; i += duration <= 1.2 ? 0.2 : 0.5) {
    const t = Math.round(i * 100) / 100;
    xTicks.push(t);
  }
  const yTicks = React.useMemo(() => {
    const steps = 4;
    const ticks: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = valueMin + (i / steps) * (valueMax - valueMin);
      ticks.push(Math.abs(t) < 1e-6 ? 0 : t);
    }
    return ticks;
  }, [valueMin, valueMax]);

  return (
    <VStack align="stretch" gap={1}>
      {label && (
        <HStack mb={1} gap={2} justify="space-between" w="100%">
          <HStack gap={2}>
            <Text fontWeight="bold" fontSize="md" color="gray.50">{label}</Text>
            <Text fontSize="xs" color="white">AU {auId}</Text>
          </HStack>
          {isPlaying && (
            <HStack gap={1}>
              <Box w={2} h={2} borderRadius="full" bg="green.400" />
              <Text fontSize="xs" color="green.400" fontWeight="bold">Playing</Text>
            </HStack>
          )}
        </HStack>
      )}
      <Box
        border="1px solid"
        borderColor="gray.600"
        rounded="md"
        bg="gray.800"
        px={0}
        py={0}
        w={`${WIDTH}px`}
        h={`${HEIGHT}px`}
        userSelect="none"
        position="relative"
      >
        <svg
          ref={svgRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ display: 'block', cursor: dragIdx != null ? 'grabbing' : 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMoveSVG}
          onPointerLeave={handlePointerLeaveSVG}
          onContextMenu={handleContextMenu}
        >
          {/* Axes */}
          <g>
            {/* X axis */}
            <line
              x1={MARGIN.left}
              y1={HEIGHT - MARGIN.bottom}
              x2={WIDTH - MARGIN.right}
              y2={HEIGHT - MARGIN.bottom}
              stroke="#aaa"
              strokeWidth={1.5}
            />
            {/* Y axis */}
            <line
              x1={MARGIN.left}
              y1={MARGIN.top}
              x2={MARGIN.left}
              y2={HEIGHT - MARGIN.bottom}
              stroke="#aaa"
              strokeWidth={1.5}
            />
            {/* X ticks */}
            {xTicks.map((t, i) => {
              const x = timeToX(t, duration);
              return (
                <g key={i}>
                  <line x1={x} y1={HEIGHT - MARGIN.bottom} x2={x} y2={HEIGHT - MARGIN.bottom + 6} stroke="#aaa" strokeWidth={1} />
                  <text
                    x={x}
                    y={HEIGHT - MARGIN.bottom + 17}
                    fontSize="10"
                    textAnchor="middle"
                    fill="#aaa"
                  >
                    {t.toFixed(1)}
                  </text>
                </g>
              );
            })}
            {/* Y ticks */}
            {yTicks.map((v, i) => {
              const y = valueToY(v, valueMin, valueMax);
              return (
                <g key={i}>
                  <line x1={MARGIN.left - 6} y1={y} x2={MARGIN.left} y2={y} stroke="#aaa" strokeWidth={1} />
                  <text
                    x={MARGIN.left - 8}
                    y={y + 3}
                    fontSize="10"
                    textAnchor="end"
                    fill="#aaa"
                  >
                    {v.toFixed(2)}
                  </text>
                  {/* Optional: grid lines */}
                  <line
                    x1={MARGIN.left}
                    y1={y}
                    x2={WIDTH - MARGIN.right}
                    y2={y}
                    stroke="#444"
                    strokeWidth={0.7}
                    strokeDasharray="3 2"
                  />
                </g>
              );
            })}
          </g>
          {/* Curve path */}
          <path
            d={getPath(editingKeyframes, duration, valueMin, valueMax)}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2.5}
          />
          {/* Playback cursor (if playing) */}
          {isPlaying && currentTime >= 0 && currentTime <= duration && (
            <g pointerEvents="none">
              <line
                x1={timeToX(currentTime, duration)}
                y1={MARGIN.top}
                x2={timeToX(currentTime, duration)}
                y2={HEIGHT - MARGIN.bottom}
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
              <circle
                cx={timeToX(currentTime, duration)}
                cy={MARGIN.top - 6}
                r={4}
                fill="#22c55e"
              />
            </g>
          )}
          {/* Keyframe points */}
          {editingKeyframes.map((kf, i) => {
            const x = timeToX(kf.time, duration);
            const y = valueToY(kf.value, valueMin, valueMax);
            const isActive = i === dragIdx || i === hoverIdx;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isActive ? POINT_RADIUS + 2 : POINT_RADIUS}
                fill={isActive ? "#fbbf24" : "#38bdf8"}
                stroke="#222"
                strokeWidth={isActive ? 2 : 1}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
              />
            );
          })}
          {/* Drag preview: show point value/time */}
          {dragIdx != null && editingKeyframes[dragIdx] && (
            <g pointerEvents="none">
              <rect
                x={timeToX(editingKeyframes[dragIdx].time, duration) + 12}
                y={valueToY(editingKeyframes[dragIdx].value, valueMin, valueMax) - 20}
                width="54"
                height="22"
                rx="6"
                fill="#18181b"
                stroke="#38bdf8"
                strokeWidth={1}
                opacity={0.92}
              />
              <text
                x={timeToX(editingKeyframes[dragIdx].time, duration) + 39}
                y={valueToY(editingKeyframes[dragIdx].value, valueMin, valueMax) - 6}
                fontSize="12"
                fill="#fbbf24"
                textAnchor="middle"
                fontWeight="bold"
              >
                {`t:${editingKeyframes[dragIdx].time.toFixed(2)}, v:${editingKeyframes[dragIdx].value.toFixed(2)}`}
              </text>
            </g>
          )}
        </svg>
      </Box>
      <Text fontSize="xs" color="white" mt={1} opacity={0.8}>
        Click to add keyframe. Drag to move. Right-click to delete.
      </Text>
    </VStack>
  );
};
