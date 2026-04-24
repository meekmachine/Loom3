# Annotation Configuration

Loom3 exposes annotation configuration through `annotationRegions` on `Profile`.

For authoring and persistence, **treat `annotationRegions` as the canonical Loom3 shape**.

The current LoomLarge runtime still reads top-level `CharacterConfig.regions` as its live source of truth, so there are still two related shapes to understand:

1. The canonical authored shape: `profile.annotationRegions`
2. The current runtime/back-compat shape: `config.regions`

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

If you are working with a full saved `CharacterConfig`, prefer `extendCharacterConfigWithPreset(...)` to build the runtime `regions` shape from the canonical authored annotation config.

Loom3 also exports package-side annotation authoring helpers:

```ts
import {
  mergeAnnotationRegionsByName,
  removeAnnotationRegionByName,
  reorderAnnotationRegions,
  resetAnnotationRegionByName,
  validateAnnotationRegions,
} from '@lovelace_lol/loom3';
```

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
  customPosition?: { x: number; y: number; z: number };
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

### `customPosition`

Explicit world-space anchor override for the region.

- If set, runtime marker systems can use it instead of a derived geometry center.
- This is useful when automatic geometry resolution is close but not exact.
- Because it is explicit authoring data, prefer storing it on `annotationRegions` rather than inventing an app-only side channel.

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

## Region suppression

Profiles can also carry:

```ts
disabledRegions?: string[];
```

Use this when a preset region should be suppressed for a specific character while preserving the rest of the preset region tree.

`extendCharacterConfigWithPreset(...)` applies `disabledRegions` through `normalizeRegionTree(...)`, which removes disabled regions and repairs parent/child links in the effective runtime region list.

## Recommended Authoring Pattern

For common behavior shared by a preset:

1. Put the default region behavior in the Loom3 preset under `annotationRegions`.
2. Override only the fields that truly differ for a specific character.

For the current LoomLarge runtime:

1. Author and persist the intended camera/marker settings in `profile.annotationRegions`.
2. Use `extendCharacterConfigWithPreset(...)` to materialize the effective runtime `config.regions` shape.
3. Treat direct writes to top-level `config.regions` as a runtime/back-compat path, not the preferred authored source of truth.

## Helper usage examples

### Merge an edited region into authored annotation overrides

```ts
const nextRegions = mergeAnnotationRegionsByName(profile.annotationRegions, [
  {
    name: 'left_eye',
    cameraAngle: 45,
    customPosition: { x: 0.02, y: 1.61, z: 0.11 },
  },
]);
```

### Remove a custom region override

```ts
const nextRegions = removeAnnotationRegionByName(profile.annotationRegions, 'visor');
```

### Restore one region back to preset defaults

```ts
const resetRegions = resetAnnotationRegionByName(
  profile.annotationRegions,
  preset.annotationRegions,
  'left_eye',
);
```

### Validate annotation authoring data before saving

```ts
const issues = validateAnnotationRegions(profile.annotationRegions, {
  disabledRegions: profile.disabledRegions,
});
```

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
