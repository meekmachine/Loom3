# Hair Customization System

A complete latticework agency for managing character hair and eyebrow customization in the LoomLarge application.

## Architecture

This system follows the latticework agency pattern with:

- **State Machine** (`hairMachine.ts`) - XState machine for managing hair state
- **Service Layer** (`hairService.ts`) - Bridges state machine with Three.js scene
- **Types** (`types.ts`) - TypeScript definitions and presets
- **UI Component** (`components/hair/HairCustomizationPanel.tsx`) - React UI for customization

## Features

### Color Customization

Pre-defined color presets including:

**Natural Colors:**
- Natural Black
- Natural Brown
- Natural Blonde
- Natural Red
- Natural Gray
- Natural White

**Neon/Emissive Colors:**
- Neon Blue (with blue emissive glow)
- Neon Pink (with pink emissive glow)
- Neon Green (with green emissive glow)
- Electric Purple (with purple emissive glow)
- Fire Orange (with orange emissive glow)

### Outline/Wireframe

- Toggle wireframe outline on/off
- Customizable outline color
- Adjustable opacity (0-1)
- Real-time preview

### Individual Part Control

Each hair/eyebrow part can be:
- Shown/hidden independently
- Scaled (future feature)
- Repositioned (future feature)

## Usage

### In the App

The hair service is automatically initialized when the character model loads. The UI panel appears in the top-right corner.

### Programmatic Control

The hair service is exposed globally for debugging:

```javascript
// Access the hair service
window.hairService

// Change hair color
window.hairService.send({
  type: 'SET_COLOR',
  color: HAIR_COLOR_PRESETS.neon_blue
})

// Toggle outline
window.hairService.send({
  type: 'SET_OUTLINE',
  show: true,
  color: '#00ff00',
  opacity: 1.0
})

// Hide a specific part
window.hairService.send({
  type: 'SET_PART_VISIBILITY',
  partName: 'Male_Bushy',
  visible: false
})

// Reset to defaults
window.hairService.send({
  type: 'RESET_TO_DEFAULT'
})
```

### Subscribe to State Changes

```typescript
const unsubscribe = hairService.subscribe((state) => {
  console.log('Hair state changed:', state);
});

// Later: cleanup
unsubscribe();
```

## Events

The state machine accepts the following events:

```typescript
type HairEvent =
  | { type: 'SET_COLOR'; color: HairColor }
  | { type: 'SET_OUTLINE'; show: boolean; color?: string; opacity?: number }
  | { type: 'SET_PART_VISIBILITY'; partName: string; visible: boolean }
  | { type: 'SET_PART_SCALE'; partName: string; scale: number }
  | { type: 'SET_PART_POSITION'; partName: string; position: [number, number, number] }
  | { type: 'RESET_TO_DEFAULT' };
```

## State Structure

```typescript
type HairState = {
  color: HairColor;              // Current hair color
  showOutline: boolean;          // Show wireframe outline?
  outlineColor: string;          // Outline color (hex)
  outlineOpacity: number;        // Outline opacity (0-1)

  parts: {
    [partName: string]: {
      name: string;
      visible: boolean;
      scale?: number;
      position?: [number, number, number];
    }
  };
};
```

## Integration

### Character Scene Integration

The `CharacterGLBScene` component automatically:

1. Scans the loaded model for hair objects (objects with names containing "hair", "bushy", "side_part", "eyebrow")
2. Initializes the `HairService` with found objects
3. Passes the service to the parent via `onReady` callback
4. Cleans up the service on unmount

### Detected Hair Objects

The system automatically detects objects with these name patterns:
- Contains "hair"
- Contains "bushy"
- Contains "side_part" or "sidepart"
- Contains "eyebrow"
- Exact match: "Male_Bushy"
- Exact match: "Side_part_wavy"

## Adding New Color Presets

Edit `types.ts` and add to `HAIR_COLOR_PRESETS`:

```typescript
export const HAIR_COLOR_PRESETS: Record<string, HairColor> = {
  // ... existing presets

  my_custom_color: {
    name: 'My Custom Color',
    baseColor: '#ff00ff',
    emissive: '#ff0000',      // Optional glow
    emissiveIntensity: 0.5,   // Optional glow intensity
  },
};
```

## Future Enhancements

- [ ] Per-part color customization (different color for hair vs eyebrows)
- [ ] Gradient/multi-color support
- [ ] Texture overlay support
- [ ] Animation (flowing/wind effects)
- [ ] Save/load presets to localStorage
- [ ] Export customization to JSON
- [ ] Integration with wind physics engine
- [ ] Hair particle system support

## Files

```
src/latticework/hair/
├── README.md                    # This file
├── types.ts                     # Type definitions and presets
├── hairMachine.ts              # XState machine
└── hairService.ts              # Service layer

src/components/hair/
├── HairCustomizationPanel.tsx  # UI component
└── HairCustomizationPanel.css  # Styles
```

## Debug Console Logs

The system provides detailed console logging:

```
[CharacterGLBScene] 🔍 Detecting hair objects...
[CharacterGLBScene] 💇 Found hair/eyebrow object: "Male_Bushy" (type: Mesh)
[CharacterGLBScene] Hair objects found: 2
[CharacterGLBScene] ✅ Hair service initialized
[HairService] Registering objects: ["Male_Bushy", "Side_part_wavy"]
[HairService] Sending event: { type: 'SET_COLOR', color: {...} }
[HairService] Applying state to scene: {...}
[App] ✓ Hair service initialized and exposed globally
```

## Contributing

When adding new features to the hair system:

1. Update the state machine in `hairMachine.ts`
2. Add corresponding actions/events
3. Update the service layer to apply changes to Three.js objects
4. Update the UI component if needed
5. Document changes in this README
