# Hair Customization System Architecture

A complete latticework agency for managing character hair and eyebrow customization in real-time.

## Overview

The hair customization system allows independent control of hair and eyebrow colors with RGB color pickers, emissive glow effects, and wireframe outlines. It follows the latticework agency pattern with XState machines, service layers, and proper separation of concerns.

## Architecture Components

### 1. **State Machine** (`hairMachine.ts`)

The XState machine manages all hair customization state with the following responsibilities:

- **State Management**: Tracks hair color, eyebrow color, outline settings, and individual part visibility
- **Event Handling**: Processes events like `SET_HAIR_COLOR`, `SET_EYEBROW_COLOR`, `SET_HAIR_GLOW`, etc.
- **State Transitions**: Uses XState `assign` actions to update state immutably

**Key Events:**
```typescript
- SET_HAIR_COLOR         // Set complete hair color preset
- SET_EYEBROW_COLOR      // Set complete eyebrow color preset
- SET_HAIR_BASE_COLOR    // Set only hair base color (RGB)
- SET_EYEBROW_BASE_COLOR // Set only eyebrow base color (RGB)
- SET_HAIR_GLOW          // Set hair emissive color and intensity
- SET_EYEBROW_GLOW       // Set eyebrow emissive color and intensity
- SET_OUTLINE            // Toggle/configure wireframe outline
- SET_PART_VISIBILITY    // Show/hide individual parts
- RESET_TO_DEFAULT       // Reset to default state
```

### 2. **Service Layer** (`hairService.ts`)

The service bridges the state machine with Three.js scene updates:

- **Object Registration**: Detects and classifies hair vs eyebrow objects
- **Material Updates**: Applies color changes to Three.js materials
- **Outline Management**: Creates/removes wireframe geometry
- **Subscription System**: Notifies UI components of state changes

**Key Methods:**
```typescript
registerObjects(objects)  // Register hair/eyebrow meshes
send(event)              // Send event to state machine
getState()               // Get current state
subscribe(callback)      // Subscribe to state changes
dispose()                // Cleanup resources
```

**Object Classification Logic:**
- Objects with names containing "male_bushy", "eyebrow", or "brow" → **Eyebrows**
- All other detected objects → **Hair**

### 3. **Type Definitions** (`types.ts`)

Defines the data structures:

```typescript
// Color configuration with base color and glow
type HairColor = {
  name: string;
  baseColor: string;           // Hex RGB color
  emissive: string;            // Emissive glow color
  emissiveIntensity: number;   // Glow intensity (0-1)
}

// Complete state
type HairState = {
  hairColor: HairColor;        // Hair color settings
  eyebrowColor: HairColor;     // Eyebrow color settings
  showOutline: boolean;
  outlineColor: string;
  outlineOpacity: number;
  parts: Record<string, HairStyle>;
}
```

**Color Presets:**
- 6 natural colors (black, brown, blonde, red, gray, white)
- 5 neon colors with glow (blue, pink, green, purple, orange)

### 4. **UI Component** (`HairCustomizationPanel.tsx`)

React component providing user controls:

- **Hair Section**: Preset selector, RGB base color picker, RGB glow color picker, glow intensity slider
- **Eyebrows Section**: Same controls as hair section
- **Outline Section**: Toggle, color picker, opacity slider
- **Parts Section**: Show/hide individual hair/eyebrow parts

## Data Flow

```
User Interaction
    ↓
UI Component (HairCustomizationPanel)
    ↓
Service Layer (hairService.send(event))
    ↓
State Machine (hairMachine - processes event)
    ↓
State Update (XState assign actions)
    ↓
Service Layer (applyStateToScene)
    ↓
Three.js Scene Update (material.color, material.emissive, wireframes)
    ↓
Visual Update (character appearance changes)
```

## Integration Points

### CharacterGLBScene Integration

When a character model loads:

1. **Detection**: Traverses model looking for objects with hair-related names
2. **Service Creation**: Creates `HairService` instance
3. **Registration**: Registers detected objects with the service
4. **Callback**: Passes service to parent via `onReady` callback

```typescript
// Detection patterns (case-insensitive):
- "hair"
- "bushy"
- "side_part" or "sidepart"
- "eyebrow"
- "male_bushy" (exact match)
- "side_part_wavy" (exact match)
```

### App Integration

The main app:

1. **State Management**: Stores hair service in React state
2. **Global Exposure**: Exposes service as `window.hairService` for debugging
3. **UI Rendering**: Passes service to `HairCustomizationPanel` component

## Technical Implementation Details

### Material Color Application

The service applies colors to Three.js materials:

```typescript
// Base color
material.color = new THREE.Color(hairColor.baseColor)

// Emissive glow
material.emissive = new THREE.Color(hairColor.emissive)
material.emissiveIntensity = hairColor.emissiveIntensity
```

### Wireframe Outline

Wireframes are created as separate geometry:

```typescript
const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry)
const wireframeMaterial = new THREE.LineBasicMaterial({
  color: outlineColor,
  opacity: outlineOpacity,
  transparent: true
})
const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial)
mesh.add(wireframe)
```

### Separation of Hair and Eyebrows

Objects are classified during registration:

```typescript
const isEyebrow =
  nameLower.includes('eyebrow') ||
  nameLower.includes('brow') ||
  nameLower.includes('male_bushy')

// During rendering:
const colorToApply = isEyebrow ? state.eyebrowColor : state.hairColor
```

## Performance Considerations

- **State Updates**: Batched through XState machine to prevent excessive re-renders
- **Material Reuse**: Modifies existing materials instead of creating new ones
- **Wireframe Caching**: Stores wireframe references to avoid recreation
- **Subscription Pattern**: UI only re-renders when subscribed state changes

## Debugging

The hair service is exposed globally for debugging:

```javascript
// Access the service
window.hairService

// Get current state
window.hairService.getState()

// Change hair color
window.hairService.send({
  type: 'SET_HAIR_BASE_COLOR',
  baseColor: '#ff0000'
})

// Set glow effect
window.hairService.send({
  type: 'SET_HAIR_GLOW',
  emissive: '#00ff00',
  intensity: 1.0
})
```

## Extension Points

### Adding New Color Presets

Edit `HAIR_COLOR_PRESETS` in `types.ts`:

```typescript
export const HAIR_COLOR_PRESETS: Record<string, HairColor> = {
  // ... existing presets

  my_custom_color: {
    name: 'My Custom Color',
    baseColor: '#custom',
    emissive: '#glow',
    emissiveIntensity: 0.5,
  },
}
```

### Adding New Events

1. Add event type to `HairEvent` union in `types.ts`
2. Add action in `hairMachine.ts` setup
3. Add event handler in machine states
4. Update UI component to send new event

### Supporting Additional Properties

1. Extend `HairState` type
2. Add new events for the property
3. Add actions to update the property
4. Implement application logic in `applyStateToScene`
5. Add UI controls

## File Structure

```
src/latticework/hair/
├── types.ts              # Type definitions and presets
├── hairMachine.ts        # XState machine
├── hairService.ts        # Service layer
├── README.md            # User documentation
└── ARCHITECTURE.md      # This file

src/components/hair/
├── HairCustomizationPanel.tsx  # UI component
└── HairCustomizationPanel.css  # Styles
```

## Dependencies

- **XState**: State machine library for managing complex state
- **Three.js**: 3D rendering engine for scene manipulation
- **React**: UI framework for the customization panel

## Best Practices

1. **Immutable Updates**: Always use XState `assign` for state updates
2. **Type Safety**: Leverage TypeScript for compile-time safety
3. **Separation of Concerns**: Keep state logic, scene updates, and UI separate
4. **Resource Cleanup**: Always dispose of wireframes and subscriptions
5. **Naming Conventions**: Use descriptive names for events and actions
