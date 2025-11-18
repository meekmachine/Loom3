/**
 * Hair Customization Panel
 *
 * UI component for customizing character hair and eyebrows separately.
 * Part of the latticework agency architecture.
 */

import React, { useEffect, useState } from 'react';
import { HairService } from '../../latticework/hair/hairService';
import { HairState, HAIR_COLOR_PRESETS } from '../../latticework/hair/types';
import './HairCustomizationPanel.css';

type Props = {
  hairService: HairService | null;
};

export function HairCustomizationPanel({ hairService }: Props) {
  const [state, setState] = useState<HairState | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (!hairService) return;

    // Get initial state
    setState(hairService.getState());

    // Subscribe to updates
    const unsubscribe = hairService.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [hairService]);

  if (!hairService || !state) {
    return (
      <div className="hair-panel">
        <div className="hair-panel-header">
          <h3>Hair Customization</h3>
        </div>
        <div className="hair-panel-body">
          <p className="text-muted">No hair service available</p>
        </div>
      </div>
    );
  }

  // Hair controls
  const handleHairPresetChange = (colorKey: string) => {
    const color = HAIR_COLOR_PRESETS[colorKey];
    if (color) {
      hairService.send({ type: 'SET_HAIR_COLOR', color });
    }
  };

  const handleHairBaseColorChange = (baseColor: string) => {
    hairService.send({ type: 'SET_HAIR_BASE_COLOR', baseColor });
  };

  const handleHairGlowColorChange = (emissive: string) => {
    hairService.send({
      type: 'SET_HAIR_GLOW',
      emissive,
      intensity: state.hairColor.emissiveIntensity,
    });
  };

  const handleHairGlowIntensityChange = (intensity: number) => {
    hairService.send({
      type: 'SET_HAIR_GLOW',
      emissive: state.hairColor.emissive,
      intensity,
    });
  };

  // Eyebrow controls
  const handleEyebrowPresetChange = (colorKey: string) => {
    const color = HAIR_COLOR_PRESETS[colorKey];
    if (color) {
      hairService.send({ type: 'SET_EYEBROW_COLOR', color });
    }
  };

  const handleEyebrowBaseColorChange = (baseColor: string) => {
    hairService.send({ type: 'SET_EYEBROW_BASE_COLOR', baseColor });
  };

  const handleEyebrowGlowColorChange = (emissive: string) => {
    hairService.send({
      type: 'SET_EYEBROW_GLOW',
      emissive,
      intensity: state.eyebrowColor.emissiveIntensity,
    });
  };

  const handleEyebrowGlowIntensityChange = (intensity: number) => {
    hairService.send({
      type: 'SET_EYEBROW_GLOW',
      emissive: state.eyebrowColor.emissive,
      intensity,
    });
  };

  // Outline controls
  const handleOutlineToggle = () => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: !state.showOutline,
    });
  };

  const handleOutlineColorChange = (color: string) => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: state.showOutline,
      color,
    });
  };

  const handleOutlineOpacityChange = (opacity: number) => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: state.showOutline,
      opacity,
    });
  };

  const handlePartVisibilityToggle = (partName: string) => {
    const currentVisibility = state.parts[partName]?.visible ?? true;
    hairService.send({
      type: 'SET_PART_VISIBILITY',
      partName,
      visible: !currentVisibility,
    });
  };

  const handleReset = () => {
    hairService.send({ type: 'RESET_TO_DEFAULT' });
  };

  const colorPresetKeys = Object.keys(HAIR_COLOR_PRESETS);

  return (
    <div className="hair-panel">
      {/* Header */}
      <div
        className="hair-panel-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3>Hair Customization</h3>
        <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="hair-panel-body">
          {/* HAIR SECTION */}
          <div className="section">
            <h4 className="section-title">Hair</h4>

            {/* Hair Preset */}
            <div className="control-group">
              <label>Preset</label>
              <select
                onChange={(e) => handleHairPresetChange(e.target.value)}
                className="color-select"
              >
                <option value="">Select Preset...</option>
                {colorPresetKeys.map((key) => (
                  <option key={key} value={key}>
                    {HAIR_COLOR_PRESETS[key].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Hair Base Color RGB */}
            <div className="control-group">
              <label>Base Color</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={state.hairColor.baseColor}
                  onChange={(e) => handleHairBaseColorChange(e.target.value)}
                  className="color-input"
                />
                <input
                  type="text"
                  value={state.hairColor.baseColor.toUpperCase()}
                  onChange={(e) => handleHairBaseColorChange(e.target.value)}
                  className="hex-input"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Hair Glow Color */}
            <div className="control-group">
              <label>Glow Color</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={state.hairColor.emissive}
                  onChange={(e) => handleHairGlowColorChange(e.target.value)}
                  className="color-input"
                />
                <input
                  type="text"
                  value={state.hairColor.emissive.toUpperCase()}
                  onChange={(e) => handleHairGlowColorChange(e.target.value)}
                  className="hex-input"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Hair Glow Intensity */}
            <div className="control-group">
              <label>Glow Intensity</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.hairColor.emissiveIntensity}
                  onChange={(e) =>
                    handleHairGlowIntensityChange(parseFloat(e.target.value))
                  }
                  className="slider"
                />
                <span className="value-display">
                  {state.hairColor.emissiveIntensity.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* EYEBROWS SECTION */}
          <div className="section">
            <h4 className="section-title">Eyebrows</h4>

            {/* Eyebrow Preset */}
            <div className="control-group">
              <label>Preset</label>
              <select
                onChange={(e) => handleEyebrowPresetChange(e.target.value)}
                className="color-select"
              >
                <option value="">Select Preset...</option>
                {colorPresetKeys.map((key) => (
                  <option key={key} value={key}>
                    {HAIR_COLOR_PRESETS[key].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Eyebrow Base Color RGB */}
            <div className="control-group">
              <label>Base Color</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={state.eyebrowColor.baseColor}
                  onChange={(e) => handleEyebrowBaseColorChange(e.target.value)}
                  className="color-input"
                />
                <input
                  type="text"
                  value={state.eyebrowColor.baseColor.toUpperCase()}
                  onChange={(e) => handleEyebrowBaseColorChange(e.target.value)}
                  className="hex-input"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Eyebrow Glow Color */}
            <div className="control-group">
              <label>Glow Color</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={state.eyebrowColor.emissive}
                  onChange={(e) => handleEyebrowGlowColorChange(e.target.value)}
                  className="color-input"
                />
                <input
                  type="text"
                  value={state.eyebrowColor.emissive.toUpperCase()}
                  onChange={(e) => handleEyebrowGlowColorChange(e.target.value)}
                  className="hex-input"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Eyebrow Glow Intensity */}
            <div className="control-group">
              <label>Glow Intensity</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.eyebrowColor.emissiveIntensity}
                  onChange={(e) =>
                    handleEyebrowGlowIntensityChange(parseFloat(e.target.value))
                  }
                  className="slider"
                />
                <span className="value-display">
                  {state.eyebrowColor.emissiveIntensity.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* OUTLINE SECTION */}
          <div className="section">
            <h4 className="section-title">Outline</h4>

            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={state.showOutline}
                  onChange={handleOutlineToggle}
                />
                Show Outline
              </label>

              {state.showOutline && (
                <div className="outline-controls">
                  <div className="color-picker-row">
                    <label>Color</label>
                    <input
                      type="color"
                      value={state.outlineColor}
                      onChange={(e) => handleOutlineColorChange(e.target.value)}
                      className="color-input"
                    />
                  </div>

                  <div className="slider-row">
                    <label>Opacity</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={state.outlineOpacity}
                      onChange={(e) =>
                        handleOutlineOpacityChange(parseFloat(e.target.value))
                      }
                      className="slider"
                    />
                    <span className="value-display">
                      {state.outlineOpacity.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* INDIVIDUAL PARTS */}
          {Object.keys(state.parts).length > 0 && (
            <div className="section">
              <h4 className="section-title">Parts</h4>
              <div className="parts-list">
                {Object.keys(state.parts).map((partName) => {
                  const part = state.parts[partName];
                  return (
                    <div key={partName} className="part-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={part.visible}
                          onChange={() => handlePartVisibilityToggle(partName)}
                        />
                        {partName}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RESET BUTTON */}
          <div className="section">
            <button onClick={handleReset} className="reset-button">
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
