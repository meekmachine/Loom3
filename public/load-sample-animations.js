/**
 * Load Sample Animations to localStorage
 * Run this script in browser console to load all sample lip sync animations
 * They will then appear in the Viseme dropdown menu in Playback Controls
 */

(async function loadSampleAnimations() {
  try {
    console.log('[LoadSamples] Fetching sample animations...');

    const response = await fetch('/docs/sample-lipsync-animations.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.snippets || !Array.isArray(data.snippets)) {
      throw new Error('Invalid JSON format - missing snippets array');
    }

    console.log(`[LoadSamples] Found ${data.snippets.length} snippets`);

    // Get existing viseme list
    let visemeList = [];
    try {
      const existing = localStorage.getItem('visemeAnimationsList');
      if (existing) {
        visemeList = JSON.parse(existing);
      }
    } catch (e) {
      console.warn('[LoadSamples] Could not parse existing viseme list:', e);
    }

    // Save each snippet to localStorage
    let added = 0;
    let updated = 0;

    data.snippets.forEach(snippet => {
      const key = `visemeAnimationsList/${snippet.name}`;
      const existed = localStorage.getItem(key);

      // Save the snippet
      localStorage.setItem(key, JSON.stringify(snippet));

      if (existed) {
        updated++;
      } else {
        added++;
        // Add to viseme list if not already there
        if (!visemeList.includes(snippet.name)) {
          visemeList.push(snippet.name);
        }
      }
    });

    // Sort the viseme list alphabetically
    visemeList.sort();

    // Update the viseme animations list
    localStorage.setItem('visemeAnimationsList', JSON.stringify(visemeList));

    console.log(`[LoadSamples] ✅ Complete!`);
    console.log(`[LoadSamples] Added: ${added}, Updated: ${updated}`);
    console.log(`[LoadSamples] Total viseme animations: ${visemeList.length}`);
    console.log(`[LoadSamples] Snippets in menu:`, visemeList);
    console.log(`[LoadSamples] Reload the page to see them in the Viseme dropdown!`);

    return {
      added,
      updated,
      total: visemeList.length,
      snippets: visemeList
    };
  } catch (error) {
    console.error('[LoadSamples] Error:', error);
    throw error;
  }
})();
