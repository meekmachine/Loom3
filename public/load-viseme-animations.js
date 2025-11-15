/**
 * Load Viseme Animations to localStorage
 * Run this script in browser console to register all viseme animations
 * They will then appear in the Viseme dropdown menu in Playback Controls
 */

(async function loadVisemeAnimations() {
  const visemeFiles = [
    'lipsync_hello',
    'lipsync_world',
    'lipsync_speech',
    'lipsync_amazing',
    'lipsync_anthropic',
    'lipsync_beautiful',
    'lipsync_hello_world',
    'lipsync_thank_you',
    'lipsync_good_morning',
    'lipsync_how_are_you'
  ];

  try {
    console.log('[LoadVisemeAnimations] Loading animations from /animations/viseme/...');

    let added = 0;
    let updated = 0;
    const errors = [];

    for (const filename of visemeFiles) {
      try {
        const response = await fetch(`/animations/viseme/${filename}.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const snippet = await response.json();
        const key = `visemeAnimationsList/${snippet.name}`;
        const existed = localStorage.getItem(key);

        // Save the snippet to localStorage
        localStorage.setItem(key, JSON.stringify(snippet));

        if (existed) {
          updated++;
        } else {
          added++;
        }

        console.log(`  ✅ ${existed ? 'Updated' : 'Added'}: ${snippet.name}`);
      } catch (err) {
        console.error(`  ❌ Failed to load ${filename}:`, err.message);
        errors.push({ filename, error: err.message });
      }
    }

    // Get existing viseme list
    let visemeList = [];
    try {
      const existing = localStorage.getItem('visemeAnimationsList');
      if (existing) {
        visemeList = JSON.parse(existing);
      }
    } catch (e) {
      console.warn('[LoadVisemeAnimations] Could not parse existing list, starting fresh');
    }

    // Add new animations to the list
    visemeFiles.forEach(filename => {
      if (!visemeList.includes(filename)) {
        visemeList.push(filename);
      }
    });

    // Sort alphabetically
    visemeList.sort();

    // Update the viseme animations list
    localStorage.setItem('visemeAnimationsList', JSON.stringify(visemeList));

    console.log('\n[LoadVisemeAnimations] ✅ Complete!');
    console.log(`  Added: ${added}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Errors: ${errors.length}`);
    console.log(`  Total animations: ${visemeList.length}`);

    if (errors.length > 0) {
      console.log('\n[LoadVisemeAnimations] Errors:');
      errors.forEach(e => console.log(`  - ${e.filename}: ${e.error}`));
    }

    console.log('\n[LoadVisemeAnimations] Animations in menu:', visemeList);
    console.log('\n💡 Reload the page to see them in the Viseme dropdown!');

    return {
      added,
      updated,
      errors: errors.length,
      total: visemeList.length,
      animations: visemeList
    };
  } catch (error) {
    console.error('[LoadVisemeAnimations] Fatal error:', error);
    throw error;
  }
})();
