/**
 * Animation Loader Utility
 * Loads and tests sample lip sync animation snippets
 */

import type { createAnimationService } from '../latticework/animation/animationService';

// Type for the animation service API
type AnimationServiceAPI = ReturnType<typeof createAnimationService>;

export interface AnimationSnippet {
  name: string;
  description?: string;
  snippetCategory: string;
  snippetPriority: number;
  snippetPlaybackRate: number;
  snippetIntensityScale: number;
  loop: boolean;
  curves: Record<string, Array<{ time: number; intensity: number }>>;
}

/**
 * Load a snippet from JSON and schedule it
 */
export function loadSnippet(anim: AnimationServiceAPI, snippet: AnimationSnippet) {
  if (!anim || !anim.schedule) {
    console.error('[AnimationLoader] Animation service not available');
    return false;
  }

  try {
    // Calculate maxTime from curves
    const maxTime = Math.max(
      ...Object.values(snippet.curves).flatMap(curve =>
        curve.map(kf => kf.time)
      )
    ) + 0.05; // Small buffer

    const snippetData = {
      name: snippet.name,
      curves: snippet.curves,
      maxTime,
      loop: snippet.loop,
      snippetCategory: snippet.snippetCategory,
      snippetPriority: snippet.snippetPriority,
      snippetPlaybackRate: snippet.snippetPlaybackRate,
      snippetIntensityScale: snippet.snippetIntensityScale,
    };

    anim.schedule(snippetData);
    console.log(`[AnimationLoader] Loaded snippet: ${snippet.name}`);
    return true;
  } catch (err) {
    console.error('[AnimationLoader] Error loading snippet:', err);
    return false;
  }
}

/**
 * Load multiple snippets
 */
export function loadSnippets(anim: AnimationServiceAPI, snippets: AnimationSnippet[]) {
  const results = snippets.map(snippet => loadSnippet(anim, snippet));
  const successCount = results.filter(r => r).length;
  console.log(`[AnimationLoader] Loaded ${successCount}/${snippets.length} snippets`);
  return successCount;
}

/**
 * Load snippets from JSON file
 */
export async function loadSnippetsFromJSON(anim: AnimationServiceAPI, jsonPath: string) {
  try {
    const response = await fetch(jsonPath);
    const data = await response.json();

    if (!data.snippets || !Array.isArray(data.snippets)) {
      console.error('[AnimationLoader] Invalid JSON format - missing snippets array');
      return 0;
    }

    return loadSnippets(anim, data.snippets);
  } catch (err) {
    console.error('[AnimationLoader] Error loading JSON:', err);
    return 0;
  }
}

/**
 * Play a specific snippet by name
 */
export function playSnippet(anim: AnimationServiceAPI, name: string, playing = true) {
  if (!anim || !anim.setSnippetPlaying) {
    console.error('[AnimationLoader] Animation service not available');
    return false;
  }

  try {
    anim.setSnippetPlaying(name, playing);
    console.log(`[AnimationLoader] ${playing ? 'Playing' : 'Paused'} snippet: ${name}`);
    return true;
  } catch (err) {
    console.error('[AnimationLoader] Error playing snippet:', err);
    return false;
  }
}

/**
 * Remove a snippet
 */
export function removeSnippet(anim: AnimationServiceAPI, name: string) {
  if (!anim || !anim.remove) {
    console.error('[AnimationLoader] Animation service not available');
    return false;
  }

  try {
    anim.remove(name);
    console.log(`[AnimationLoader] Removed snippet: ${name}`);
    return true;
  } catch (err) {
    console.error('[AnimationLoader] Error removing snippet:', err);
    return false;
  }
}

/**
 * Clear all snippets
 */
export function clearAllSnippets(anim: AnimationServiceAPI) {
  if (!anim || !anim.getState) {
    console.error('[AnimationLoader] Animation service not available');
    return 0;
  }

  try {
    const state = anim.getState();
    const animations = (state?.context?.animations || []) as any[];

    animations.forEach(snippet => {
      if (snippet?.name) {
        anim.remove(snippet.name);
      }
    });

    console.log(`[AnimationLoader] Cleared ${animations.length} snippets`);
    return animations.length;
  } catch (err) {
    console.error('[AnimationLoader] Error clearing snippets:', err);
    return 0;
  }
}

// Make utilities available globally in dev mode for console testing
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).animLoader = {
    loadSnippet,
    loadSnippets,
    loadSnippetsFromJSON,
    playSnippet,
    removeSnippet,
    clearAllSnippets
  };
  console.log('[AnimationLoader] Global utilities available: window.animLoader');
}
