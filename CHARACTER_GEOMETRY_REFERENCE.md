# Character Geometry Reference

Complete documentation of character model structure, based on Character Creator 4 (CC4) GLB exports.

**Last Updated:** 2025-11-24
**Model Source:** Character Creator 4 (CC4)
**Character:** jonathan.glb

---

## Table of Contents
1. [Overview](#overview)
2. [Mesh Objects](#mesh-objects)
3. [Hair System](#hair-system)
4. [Eyebrow System](#eyebrow-system)
5. [Bone Structure](#bone-structure)
6. [Shape Keys (Morph Targets)](#shape-keys-morph-targets)
7. [Multi-Mesh Objects](#multi-mesh-objects)

---

## Overview

Character Creator 4 exports GLB files with a hierarchical structure:
- **Root Scene**: Contains all objects
- **Meshes**: Separate mesh objects for body parts, hair, eyebrows, eyes, etc.
- **Bones**: Skeletal rig for animation (jaw, head, neck, eyes, tongue)
- **Shape Keys**: Morph targets for facial animation (AU-based blend shapes)

### Total Object Count
Based on jonathan.glb:
- **Total Objects**: ~100+ objects (including bones, meshes, helpers)
- **Meshes with Shape Keys**: 15 meshes
- **Total Unique Shape Keys**: 195 blend shapes

---

## Mesh Objects

### Body Meshes
Character Creator splits the body into multiple material slots:

```
CC_Base_Body_1  - Body mesh (material slot 1) - 80 shape keys
CC_Base_Body_2  - Body mesh (material slot 2) - 80 shape keys
CC_Base_Body_3  - Body mesh (material slot 3) - 80 shape keys
CC_Base_Body_4  - Body mesh (material slot 4) - 80 shape keys
CC_Base_Body_5  - Body mesh (material slot 5) - 80 shape keys
CC_Base_Body_6  - Body mesh (material slot 6) - 80 shape keys
```

**Why Multiple Body Meshes?**
- Each mesh uses a different material (skin, clothing, accessories)
- All share the same 80 facial blend shapes for AU-based animation
- Allows different shaders/textures per body region

**Common Material Slots:**
- Slot 1: Face/head skin
- Slot 2: Body skin
- Slot 3: Clothing (shirt/top)
- Slot 4: Clothing (pants/bottom)
- Slot 5: Accessories (shoes, belts, jewelry)
- Slot 6: Additional accessories or hair caps

### Eye Meshes
```
CC_Base_Eye        - Left eyeball mesh  - 0 shape keys (animated via bones)
CC_Base_Eye_1      - Right eyeball mesh - 0 shape keys (animated via bones)

CC_Base_EyeOcclusion_1  - Left eye occlusion  - 94 shape keys
CC_Base_EyeOcclusion_2  - Right eye occlusion - 94 shape keys

CC_Base_TearLine_1      - Left tear line      - 90 shape keys
CC_Base_TearLine_2      - Right tear line     - 90 shape keys
```

**Eyeball Meshes (CC_Base_Eye, CC_Base_Eye_1):**
- These are the actual eyeball geometry (iris, pupil, sclera)
- Animated by eye bones (CC_Base_L_Eye, CC_Base_R_Eye), not shape keys
- No morph targets - rotation only
- Handle gaze direction (AU61-64)

**Eye Occlusion Purpose:**
- Creates proper eyelid closure over eyeball
- Prevents eyeball from clipping through eyelids
- More shape keys than body (94 vs 80) for detailed eye expressions
- Handles blink (AU45), squint (AU44), widen (AU5)

**Tear Line Purpose:**
- Adds wetness/moisture to lower eyelid
- Creates realistic eye moisture and tear ducts
- Follows eye expressions

### Teeth Meshes
```
CC_Base_Teeth_1  - Upper teeth - 0 shape keys
CC_Base_Teeth_2  - Lower teeth - 0 shape keys
```

**Note:** Teeth have no shape keys - they follow jaw bone movement

### Tongue Mesh
```
CC_Base_Tongue  - Tongue mesh - 23 shape keys
```

**Note:** Tongue has fewer shape keys (23) focused on tongue-specific AUs (37-40, 115-120)

### Other Standard CC4 Meshes
```
CC_Base_Cornea        - Eye cornea (transparent layer over iris)
CC_Base_Cornea_1      - (may be duplicate or alternative cornea mesh)
```

**Common but Optional Meshes (depend on character customization):**
```
CC_Base_Teeth_Gums    - Gums visible when smiling
CC_Base_Eyelashes_1   - Left eyelashes
CC_Base_Eyelashes_2   - Right eyelashes
```

---

## Hair System

### Hair Object Structure
Hair is split into **multiple mesh objects** with numbered suffixes:

```
Side_part_wavy_1  - Hair mesh (part 1) - 14 shape keys
Side_part_wavy_2  - Hair mesh (part 2) - 14 shape keys
```

### Critical Implementation Detail
⚠️ **IMPORTANT**: When updating hair properties (color, visibility, etc.), you MUST update ALL numbered variants!

**Wrong (only updates one mesh):**
```typescript
const hair = model.getObjectByName('Side_part_wavy_1');
hair.material.color.set('#ff0000'); // ❌ Only updates _1, not _2
```

**Correct (updates all meshes):**
```typescript
model.traverse((obj) => {
  if (obj.name === 'Side_part_wavy_1' || obj.name === 'Side_part_wavy_2') {
    (obj as THREE.Mesh).material.color.set('#ff0000'); // ✅ Updates both
  }
});
```

**Current Implementation:**
- See `EngineThree.applyHairStateToObject()` (line 1387) - traverses model and finds ALL matching objects
- See `CharacterGLBScene.tsx` (line 240) - logs all objects during model load

### Hair Shape Keys
Hair meshes have **14 shape keys** for styling and partial movement:

**Current Available Morphs (Side_part_wavy hair):**
1. `Fluffy_Bottom_ALL` - Adds volume to bottom of hair
2. `Fluffy_Right` - Adds volume to right side
3. `Hairline_High_ALL` - Raises hairline all around
4. `Hairline_High_M` - Raises hairline in middle
5. `Hairline_High_R` - Raises hairline on right
6. `Hairline_Low_ALL` - Lowers hairline all around
7. `Hairline_Low_M` - Lowers hairline in middle
8. `Hairline_Low_R` - Lowers hairline on right
9. `Hairline_Out_All` - Pushes hairline outward
10. **`L_Hair_Front`** - Moves long section forward ✓
11. **`L_Hair_Left`** - Moves long section left ✓
12. **`L_Hair_Right`** - Moves long section right ✓
13. `Length_Long` - Makes hair longer
14. `Length_Short` - Makes hair shorter

**Limitations:**
- The `L_Hair_*` morphs only affect the long section of hair, not the entire hair mesh
- No `L_Hair_Back` morph exists for backward movement
- For full directional hair movement (all hair sections moving together), you need to enable **Hair Physics** in Character Creator 4

**Enabling Full Hair Physics in CC4:**
To get comprehensive directional movement morphs:
1. In Character Creator 4, select the hair object
2. Go to Physics settings
3. Enable "Hair Physics" or "Dynamic Hair"
4. Re-export the GLB file

This will add additional shape keys like:
- `Hair_All_Forward` / `Hair_All_Back`
- `Hair_All_Left` / `Hair_All_Right`
- Wind simulation morphs
- Gravity morphs
- These affect the ENTIRE hair mesh, not just sections

**Animation Implementation:**
Hair can be animated using the existing morph target system:
```typescript
// Via HairService (recommended)
hairService.animateHairMorph(morphKey, targetValue, durationMs);
hairService.setHairMorph(morphKey, value);

// Via EngineThree directly
engine.transitionMorph(morphKey, targetValue, durationMs);
engine.setMorph(morphKey, value);
```

**Available Methods:**
- `HairService.animateHairMorph()` - Smoothly animate to target value
- `HairService.setHairMorph()` - Instantly set morph value
- `HairService.getAvailableHairMorphs()` - Get list of available shape keys

**UI Controls:**
Hair animation controls are available in `HairCustomizationPanel` under the "Hair Animation" section

### Hair Detection
Hair objects are detected using pattern matching in `shapeDict.ts`:

**Registered Hair Names:**
```typescript
'CC_Base_Hair': 'hair',
'Hair': 'hair',
'Ponytail': 'hair',
'Braid': 'hair',
'Bangs': 'hair',
'Sideburns': 'hair',
'Side_part_wavy': 'hair',  // ← Current character uses this
```

**Pattern Matching:**
- Case-insensitive name matching
- Checks exact registry first
- Falls back to pattern matching (contains "hair", "ponytail", etc.)

---

## Eyebrow System

### Eyebrow Object Structure
Like hair, eyebrows use **multiple numbered meshes**:

```
Male_Bushy_1  - Eyebrow mesh (part 1) - 91 shape keys
Male_Bushy_2  - Eyebrow mesh (part 2) - 91 shape keys
```

### Eyebrow Shape Keys
Eyebrows have **91 shape keys** (more than body) for:
- Detailed eyebrow movement (AU1, AU2, AU4, AU7)
- Facial expressions (surprise, anger, sadness)
- Follows head movement

### Eyebrow Detection
Eyebrow objects are detected using pattern matching in `shapeDict.ts`:

**Registered Eyebrow Names:**
```typescript
'Male_Bushy': 'eyebrow',     // ← Current character uses this
'Eyebrow_L': 'eyebrow',
'Eyebrow_R': 'eyebrow',
'Brow_L': 'eyebrow',
'Brow_R': 'eyebrow',
```

### Rendering Order
Hair renders **after** eyebrows to ensure proper layering (higher renderOrder = renders later/on top):
```typescript
mesh.renderOrder = isEyebrow ? 0 : 1;  // Eyebrows: 0 (first), Hair: 1 (after/on top)
```

**Implementation:** Render order is set during object registration in `EngineThree.registerHairObjects()` (line 1365) and maintained when colors are updated in `setHairColor()` (line 1303).

---

## Multi-Mesh Objects

### Why Split into Multiple Meshes?

Character Creator splits objects (hair, eyebrows, body) into multiple meshes for:

1. **Material Limits**: WebGL/Three.js has limits on materials per mesh
2. **Performance**: Smaller meshes are easier to cull and render
3. **UV Mapping**: Different UV layouts for different regions
4. **Vertex Limits**: Large meshes may exceed vertex count limits

### Naming Convention
```
ObjectName_1  - First part
ObjectName_2  - Second part
ObjectName_3  - Third part (if needed)
```

### Implementation Pattern
When working with character objects, ALWAYS traverse to find all variants:

```typescript
// ❌ BAD - Only finds first match
const obj = model.getObjectByName('Side_part_wavy_1');

// ✅ GOOD - Finds all matches
const objects: THREE.Object3D[] = [];
model.traverse((obj) => {
  if (obj.name.startsWith('Side_part_wavy')) {
    objects.push(obj);
  }
});
```

**See Implementation:**
- `EngineThree.applyHairStateToObject()` - Lines 1387-1445
- `HairService.applyStateToScene()` - Applies state to all registered objects

---

## Bone Structure

### Complete Skeletal Hierarchy
CC4 exports a full humanoid skeleton. Below are the key bones for facial animation:

```typescript
EYE_L   : 'CC_Base_L_Eye'        // Left eyeball
EYE_R   : 'CC_Base_R_Eye'        // Right eyeball
JAW     : 'CC_Base_JawRoot'      // Jaw bone (open/close mouth)
HEAD    : 'CC_Base_Head'         // Head bone (turn, tilt, nod)
NECK    : 'CC_Base_NeckTwist01'  // Primary neck bone
NECK2   : 'CC_Base_NeckTwist02'  // Secondary neck bone (twist)
TONGUE  : 'CC_Base_Tongue01'     // Tongue bone
```

### Full CC4 Skeleton Structure
The complete skeleton includes (but not limited to):

**Head & Face:**
```
CC_Base_FacialBone    - Root for facial rig
CC_Base_Head          - Head bone
CC_Base_NeckTwist01   - Upper neck
CC_Base_NeckTwist02   - Lower neck/twist
CC_Base_JawRoot       - Jaw root
CC_Base_L_Eye         - Left eye
CC_Base_R_Eye         - Right eye
CC_Base_Tongue01      - Tongue
```

**Upper Body:**
```
CC_Base_Hip           - Root bone
CC_Base_Waist         - Waist/spine base
CC_Base_Spine01       - Lower spine
CC_Base_Spine02       - Mid spine
CC_Base_NeckTwist01   - Neck
CC_Base_L_Clavicle    - Left collar bone
CC_Base_R_Clavicle    - Right collar bone
CC_Base_L_Upperarm    - Left upper arm
CC_Base_R_Upperarm    - Right upper arm
CC_Base_L_Forearm     - Left forearm
CC_Base_R_Forearm     - Right forearm
CC_Base_L_Hand        - Left hand
CC_Base_R_Hand        - Right hand
(+ finger bones for each hand)
```

**Lower Body:**
```
CC_Base_L_Thigh       - Left thigh
CC_Base_R_Thigh       - Right thigh
CC_Base_L_Calf        - Left calf
CC_Base_R_Calf        - Right calf
CC_Base_L_Foot        - Left foot
CC_Base_R_Foot        - Right foot
(+ toe bones)
```

### Bone Animation (Facial Focus)
Bones are used for:
- **Eye Movement**: AU61-64 (gaze direction)
- **Head Movement**: AU31-33, 54-56 (head turn, tilt, nod)
- **Jaw Movement**: AU25-27 (mouth open, jaw thrust)
- **Tongue Movement**: AU37-40, 115-120 (tongue out, up, down, left, right)

### Object Types in Scene Hierarchy
When traversing the model, you'll encounter:

**Type: "Mesh"**
- Renderable geometry with materials
- May have shape keys (morph targets)
- Examples: CC_Base_Body_1, Side_part_wavy_1

**Type: "Bone"**
- Skeletal rig nodes
- Control deformation of meshes
- Examples: CC_Base_Head, CC_Base_L_Eye

**Type: "Group"**
- Empty nodes for organization
- Used as parent containers
- No geometry, just transforms

**Type: "Object3D"**
- Generic Three.js object
- Helper nodes, lights, cameras

**See:**
- `EngineThree.resolveBones()` - Line 1230
- `BONE_AU_TO_BINDINGS` in `shapeDict.ts` - Maps AUs to bone rotations
- `CC4_BONE_NODES` in `shapeDict.ts` - Line 349 - Canonical bone names

---

## Shape Keys (Morph Targets)

### Shape Key Counts by Mesh Type

| Mesh Type | Shape Key Count | Purpose |
|-----------|----------------|---------|
| Body (CC_Base_Body_*) | 80 | Facial expressions (AU-based) |
| Eye Occlusion | 94 | Eyelid movement, eye expressions |
| Tear Line | 90 | Eye wetness, tear duct movement |
| Eyebrows (Male_Bushy_*) | 91 | Eyebrow expressions |
| Tongue | 23 | Tongue movement |
| Hair (Side_part_wavy_*) | 14 | Hair physics, head follow |

### Total Unique Shape Keys: 195

### Shape Key Naming Convention
CC4 uses AU-based naming:
```
browDown_L        - AU4 Left (brow furrow)
browDown_R        - AU4 Right
browInnerUp_L     - AU1 Left (inner brow raise)
browInnerUp_R     - AU1 Right
eyeBlink_L        - AU45 Left (blink)
eyeBlink_R        - AU45 Right
jawOpen           - AU25/26 (jaw drop)
mouthSmile_L      - AU12 Left (smile)
mouthSmile_R      - AU12 Right
```

**See:**
- `AU_TO_MORPHS` in `shapeDict.ts` - Complete AU to morph mapping
- `EngineThree.setMorph()` - Line 355 - Morph application
- Shape key inventory logged on model load (see console)

---

## Logging and Debugging

### Automatic Model Logging
When a character model loads, the system automatically logs:

1. **Full Geometry Inventory** (console.table)
   - All objects in the model
   - Object type (Mesh, Bone, Group)
   - Visibility, materials, geometry

2. **Hair Object Detection**
   - Which objects were classified as hair/eyebrows
   - How many objects found
   - Object names and types

3. **Shape Key Inventory**
   - Meshes with morph targets
   - Number of shape keys per mesh
   - Total unique shape keys

**See:**
- `CharacterGLBScene.tsx` - Lines 237-277
- `EngineThree.logResolvedOnce()` - Lines 1707-1728

### Browser Console Access
For debugging, the following are exposed globally:
```typescript
window.engine        // EngineThree instance
window.hairService   // HairService instance
window.model         // Current character model (THREE.Object3D)
```

**Example Debug Commands:**
```javascript
// List all hair objects
model.traverse(obj => {
  if (obj.name.includes('hair') || obj.name.includes('wavy')) {
    console.log(obj.name, obj.type, obj.isMesh);
  }
});

// Check hair color
const hair = model.getObjectByName('Side_part_wavy_1');
console.log(hair.material.color);

// List all shape keys
const mesh = model.getObjectByName('CC_Base_Body_1');
console.log(mesh.morphTargetDictionary);
```

---

## Key Findings & Gotchas

### ⚠️ Critical Issues to Avoid

1. **Multi-Mesh Objects**
   - Hair and eyebrows use multiple numbered meshes (_1, _2)
   - MUST update ALL variants, not just the first one
   - Use `model.traverse()` instead of `getObjectByName()`

2. **getObjectByName() Limitation**
   - Only returns the FIRST object with matching name
   - Will silently fail to update other numbered variants
   - Led to "half the hair disappearing" bug

3. **Shape Key Access**
   - Body meshes need `occlusion` and `tearline` filtered out
   - Not all meshes have shape keys
   - Some AUs use multiple shape keys (Left/Right variants)

4. **Render Order**
   - Eyebrows must render before hair (renderOrder: 0 vs 1)
   - Prevents z-fighting and improper layering

5. **Material Updates**
   - Use `.set()` not direct assignment for colors
   - Must mark `material.needsUpdate = true`
   - Must mark `geometry.attributes.position.needsUpdate = true` for vertex changes

---

## Related Documentation

- **Hair System Architecture**: `src/latticework/hair/ARCHITECTURE.md`
- **Hair Vertex Manipulation**: `HAIR_VERTEX_MANIPULATION.md`
- **Shape Dictionary**: `src/engine/arkit/shapeDict.ts`
- **GLB Loading**: `GLB_LOADING_ANALYSIS.md`
- **Latticework Architecture**: `docs/LATTICEWORK_ROADMAP.md`

---

## File Locations

### Core Implementation Files
```
src/engine/EngineThree.ts                    - Hair color/state application
src/engine/arkit/shapeDict.ts                - Hair/eyebrow classification
src/scenes/CharacterGLBScene.tsx             - Model loading, hair detection
src/latticework/hair/hairService.ts          - Hair state management
src/latticework/hair/hairMachine.ts          - Hair state machine
src/components/hair/HairCustomizationPanel.tsx - Hair UI controls
```

### Key Methods
```typescript
// Hair/Eyebrow Detection
classifyHairObject(name: string)                    // shapeDict.ts:636

// Hair State Application
EngineThree.applyHairStateToObject(name, state)     // EngineThree.ts:1387
EngineThree.setHairColor(mesh, color, ...)          // EngineThree.ts:1283
EngineThree.setHairOutline(mesh, show, ...)         // EngineThree.ts:1325

// Hair Registration
EngineThree.registerHairObjects(objects)            // EngineThree.ts:1348
HairService.registerObjects(objects)                // hairService.ts:45
```

---

## Complete Object Categories

### Summary of All CC4 Object Types

**Renderable Meshes (Type: "Mesh"):**
- Body (CC_Base_Body_1 through _6) - 6 meshes
- Eyes (CC_Base_Eye, CC_Base_Eye_1) - 2 meshes
- Eye Occlusion (CC_Base_EyeOcclusion_1, _2) - 2 meshes
- Tear Lines (CC_Base_TearLine_1, _2) - 2 meshes
- Cornea (CC_Base_Cornea, CC_Base_Cornea_1) - 2 meshes
- Teeth (CC_Base_Teeth_1, _2) - 2 meshes
- Tongue (CC_Base_Tongue) - 1 mesh
- Hair (varies by style, e.g., Side_part_wavy_1, _2) - 2+ meshes
- Eyebrows (varies by style, e.g., Male_Bushy_1, _2) - 2+ meshes
- Optional: Eyelashes, Gums, etc.

**Bones (Type: "Bone"):**
- Full humanoid skeleton (~70-100 bones)
- Key facial bones: Head, Neck, Jaw, Eyes, Tongue
- Body bones: Spine, Arms, Hands, Legs, Feet
- Finger/toe bones for detailed animation

**Organizational Nodes (Type: "Group" or "Object3D"):**
- Scene root
- Skeleton root
- Mesh containers
- Helper nodes for animation

**Total Object Count:** ~100-150 objects depending on character complexity

### Object Naming Patterns

**CC4 Standard Naming:**
```
CC_Base_[BodyPart]       - Single mesh (e.g., CC_Base_Tongue)
CC_Base_[BodyPart]_N     - Multi-mesh with numbering (e.g., CC_Base_Body_1)
[StyleName]_N            - Custom assets with numbering (e.g., Side_part_wavy_1)
```

**Common Suffixes:**
```
_1, _2, _3, ...          - Numbered mesh variants (CRITICAL: must handle all!)
_L, _R                   - Left/Right variants (less common for meshes, more for bones)
```

## Summary

**Character geometry is split into many objects for technical reasons (materials, performance, UV mapping).**

**Critical takeaway:** When updating character properties (especially hair/eyebrows), you MUST handle multi-mesh objects by traversing the entire model to find ALL numbered variants. Using `getObjectByName()` will only find the first match and cause partial updates.

The current implementation correctly handles this via `EngineThree.applyHairStateToObject()` which traverses the model and applies state to all matching objects.

### Quick Reference: Object Count Expectations

| Category | Typical Count | Notes |
|----------|--------------|-------|
| Body Meshes | 6 | One per material slot |
| Eye-related Meshes | 8 | Eyes, occlusion, tear lines, cornea |
| Teeth Meshes | 2 | Upper and lower |
| Tongue Mesh | 1 | Single mesh with shape keys |
| Hair Meshes | 2-4 | Depends on complexity |
| Eyebrow Meshes | 2 | Left and right or numbered variants |
| Bones | 70-100 | Full humanoid skeleton |
| Groups/Helpers | 20-40 | Organization and hierarchy |
| **Total Objects** | **~100-150** | Varies by character |
