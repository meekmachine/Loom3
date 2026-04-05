# Annotation Configuration

Loom3 exposes annotation configuration through `annotationRegions` on `Profile`, but the current LoomLarge demo/runtime still reads top-level `CharacterConfig.regions` as the live source of truth.

> Note
> Annotations have not been moved from the demo project into Loom3 yet, but we plan to move them soon.

This means there are two related shapes to know about:

1. The Loom3 profile shape: `profile.annotationRegions`
2. The current LoomLarge runtime shape: `config.regions`

## Current Runtime Truth

Today, the camera and marker runtime in LoomLarge reads top-level region entries like this:

```ts
const config = {
  characterId: 'jonathan',
  characterName: 'Jonathan',
  modelPath: 'characters/jonathan_new.glb',
  auPresetType: 'cc4',
  regions: [
    {
      name: 'left_eye',
      bones: ['CC_Base_L_Eye'],
      parent: 'head',
      paddingFactor: 0.5,
      cameraAngle: 45,
    },
    {
      name: 'right_eye',
      bones: ['CC_Base_R_Eye'],
      parent: 'head',
      paddingFactor: 0.5,
      cameraAngle: 315,
    },
  ],
};
```

If you are trying to change what the current LoomLarge camera does, this is the shape that is active today.

## Loom3 Profile Shape

Loom3 itself supports preset-level annotation defaults through `annotationRegions` on `Profile`:

```ts
import type { Profile } from '@lovelace_lol/loom3';

export const HUMAN_ANNOTATION_OVERRIDES: Partial<Profile> = {
  annotationRegions: [
    { name: 'left_eye', paddingFactor: 0.5, cameraAngle: 45 },
    { name: 'right_eye', paddingFactor: 0.5, cameraAngle: 315 },
  ],
};
```

`extendPresetWithProfile()` merges `annotationRegions` by region name, so a profile can override just the fields it needs without copying the full preset region array.

## Region Fields

Each annotation region supports these fields:

```ts
interface AnnotationRegion {
  name: string;
  bones?: string[];
  meshes?: string[];
  objects?: string[];
  paddingFactor?: number;
  cameraAngle?: number;
  cameraOffset?: { x?: number; y?: number; z?: number };
  parent?: string;
  children?: string[];
  expandAnimation?: 'outward' | 'staggered';
  style?: {
    markerColor?: number;
    markerRadius?: number;
    lineColor?: number;
    labelColor?: string;
    labelBackground?: string;
    labelFontSize?: number;
    opacity?: number;
    lineDirection?:
      | 'radial'
      | 'camera'
      | 'up'
      | 'down'
      | 'left'
      | 'right'
      | 'forward'
      | 'backward'
      | { x: number; y: number; z: number };
    line?: {
      style?: 'solid' | 'dashed' | 'dotted';
      curve?: 'straight' | 'bezier' | 'arc';
      arrowHead?: boolean;
      thickness?: number;
      length?: number;
    };
  };
  groupId?: string;
  isFallback?: boolean;
}
```

## Camera Fields

These are the fields that affect camera framing directly in the current runtime:

### `paddingFactor`

Camera distance multiplier for the region.

- Smaller values zoom in more.
- Larger values zoom out more.
- Runtime safety clamps may still stop the camera from moving closer for very small targets.

### `cameraAngle`

Horizontal orbit angle around the target, in degrees.

- `0` = front
- `180` = back
- `90` / `270` = side angles
- `45` / `315` = quarter-angle front-side views

Important runtime detail:

- If `cameraAngle` is omitted, the runtime may auto-angle small off-center targets such as eyes.
- If `cameraAngle: 0` is set explicitly, that forces a front view and disables the implicit auto-angle behavior.

Important laterality detail:

- `90` and `270` are treated as semantic side angles and can be remapped by the runtime for mirrored rigs.
- Other values such as `45` and `315` are treated as literal angles and are not automatically mirrored.

### `cameraOffset`

Final additive offset applied after the camera position is computed.

- Use this for small nudges.
- Do not use it as a replacement for semantic left/right camera behavior.
- In the current runtime it is applied in world space, not in model-local space.

## Marker Fields

These fields affect marker presentation, not camera framing:

### `style.lineDirection`

Controls the annotation line direction for marker placement.

- This changes where the marker line projects.
- It does not set the camera orbit angle.

### `style.line`

Controls line style, curve, arrow head, thickness, and length for marker rendering.

## Geometry Target Fields

### `bones`

Names the bones used to define the annotation target.

Use this for stable semantic targets such as:

- `CC_Base_L_Eye`
- `CC_Base_R_Eye`
- `CC_Base_Head`
- `CC_Base_JawRoot`

### `meshes`

Names meshes used to define the region target.

Use this when the visible annotation surface is better described by mesh geometry than by a bone.

### `objects`

General object targets. `['*']` means the whole model.

## Recommended Authoring Pattern

For common behavior shared by a preset:

1. Put the default region behavior in the Loom3 preset under `annotationRegions`.
2. Override only the fields that truly differ for a specific character.

For the current LoomLarge runtime:

1. Put the active camera/marker settings in top-level `config.regions`.
2. Treat `profile.annotationRegions` as the intended Loom3-native shape, not the currently consumed demo-app source of truth.

## Example: Eye Closeup

```ts
{
  name: 'left_eye',
  bones: ['CC_Base_L_Eye'],
  parent: 'head',
  paddingFactor: 0.5,
  cameraAngle: 45,
}
```

This means:

- target the left eye bone
- treat it as a child of `head`
- zoom in tightly
- approach from a front-side quarter angle
