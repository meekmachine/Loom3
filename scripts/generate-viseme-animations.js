/**
 * Generate Viseme Animation JSON Files
 * Creates realistic lip sync animations with sharp, independent viseme articulation
 */

const fs = require('fs');
const path = require('path');

// Timing constants (in seconds)
const TIMING = {
  attack: 0.02,      // 20ms snap to peak
  plosive: 0.05,     // 50ms hold for p,b,t,d,k,g
  fricative: 0.07,   // 70ms hold for s,z,f,v,th,sh
  nasal: 0.06,       // 60ms hold for m,n,ng
  liquid: 0.08,      // 80ms hold for l,r,w,y
  shortVowel: 0.10,  // 100ms hold for ih,eh,uh
  longVowel: 0.14,   // 140ms hold for ee,ah,oo,oh,ae
  gap: 0.02          // 20ms neutral gap between phonemes
};

// Jaw opening by viseme index
const JAW_OPENING = {
  0: 80,  // Ah - very wide
  1: 40,  // W_OO - rounded
  2: 70,  // Oh - wide round
  3: 20,  // EE - lips spread
  4: 45,  // Er - medium
  5: 30,  // IH - small
  6: 65,  // AE - wide
  7: 30,  // R - medium
  8: 10,  // S_Z - narrow
  9: 20,  // Ch_J - slight
  10: 15, // F_V - narrow
  11: 20, // TH - slight
  12: 15, // T_L_D_N - alveolar
  13: 0,  // B_M_P - closed
  14: 35  // K_G_H_NG - velar
};

function createVisemeCurve(visemeIndex, startTime, duration) {
  return [
    { time: startTime, intensity: 0 },
    { time: startTime + TIMING.attack, intensity: 100 },
    { time: startTime + duration - TIMING.attack, intensity: 100 },
    { time: startTime + duration, intensity: 0 }
  ];
}

function createJawCurve(phonemes) {
  const curve = [];
  let currentTime = 0;

  curve.push({ time: 0, intensity: 0 });

  phonemes.forEach((ph, idx) => {
    const jawOpen = JAW_OPENING[ph.visemeIndex] || 0;
    const anticipation = idx > 0 ? TIMING.gap : 0;

    // Anticipate vowel opening
    if (jawOpen > 30) {
      curve.push({ time: currentTime + anticipation, intensity: jawOpen * 0.3 });
    }

    // Peak during phoneme
    curve.push({ time: currentTime + ph.duration * 0.3, intensity: jawOpen });
    curve.push({ time: currentTime + ph.duration * 0.9, intensity: jawOpen });

    currentTime += ph.duration + TIMING.gap;
  });

  curve.push({ time: currentTime, intensity: 0 });
  return curve;
}

function generateAnimation(name, description, phonemes) {
  const curves = {};
  let currentTime = 0;

  // Create viseme curves
  phonemes.forEach((ph, idx) => {
    const visemeId = ph.visemeIndex.toString();

    if (!curves[visemeId]) {
      curves[visemeId] = [];
    }

    const startTime = currentTime + (idx > 0 ? TIMING.gap : 0);
    const curve = createVisemeCurve(ph.visemeIndex, startTime, ph.duration);

    curves[visemeId].push(...curve);
    currentTime += ph.duration + (idx > 0 ? TIMING.gap : 0);
  });

  // Create jaw curve
  curves['26'] = createJawCurve(phonemes);

  return {
    name,
    description,
    snippetCategory: "combined",
    snippetPriority: 50,
    snippetPlaybackRate: 1.0,
    snippetIntensityScale: 1.0,
    loop: false,
    curves
  };
}

// Animation definitions
const animations = [
  {
    name: "lipsync_world",
    description: "Word: 'world' - /W ER L D/",
    phonemes: [
      { visemeIndex: 7, duration: TIMING.liquid },     // W
      { visemeIndex: 4, duration: TIMING.longVowel },  // ER
      { visemeIndex: 14, duration: TIMING.liquid },    // L
      { visemeIndex: 12, duration: TIMING.plosive }    // D - alveolar
    ]
  },
  {
    name: "lipsync_speech",
    description: "Word: 'speech' - /S P IY CH/",
    phonemes: [
      { visemeIndex: 8, duration: TIMING.fricative },  // S
      { visemeIndex: 13, duration: TIMING.plosive },   // P
      { visemeIndex: 3, duration: TIMING.longVowel },  // IY (EE)
      { visemeIndex: 9, duration: TIMING.fricative }   // CH
    ]
  },
  {
    name: "lipsync_amazing",
    description: "Word: 'amazing' - /AH M EY Z IH NG/",
    phonemes: [
      { visemeIndex: 0, duration: TIMING.longVowel },  // AH
      { visemeIndex: 13, duration: TIMING.nasal },     // M
      { visemeIndex: 6, duration: TIMING.longVowel },  // EY (AE)
      { visemeIndex: 8, duration: TIMING.fricative },  // Z
      { visemeIndex: 5, duration: TIMING.shortVowel }, // IH
      { visemeIndex: 14, duration: TIMING.nasal }      // NG
    ]
  },
  {
    name: "lipsync_anthropic",
    description: "Word: 'anthropic' - /AE N TH R AH P IH K/",
    phonemes: [
      { visemeIndex: 6, duration: TIMING.shortVowel }, // AE
      { visemeIndex: 12, duration: TIMING.nasal },     // N
      { visemeIndex: 11, duration: TIMING.fricative }, // TH
      { visemeIndex: 7, duration: TIMING.liquid },     // R
      { visemeIndex: 0, duration: TIMING.shortVowel }, // AH
      { visemeIndex: 13, duration: TIMING.plosive },   // P
      { visemeIndex: 5, duration: TIMING.shortVowel }, // IH
      { visemeIndex: 14, duration: TIMING.plosive }    // K
    ]
  },
  {
    name: "lipsync_beautiful",
    description: "Word: 'beautiful' - /B Y UW T AH F AH L/",
    phonemes: [
      { visemeIndex: 13, duration: TIMING.plosive },   // B
      { visemeIndex: 7, duration: TIMING.liquid },     // Y
      { visemeIndex: 1, duration: TIMING.longVowel },  // UW (W_OO)
      { visemeIndex: 12, duration: TIMING.plosive },   // T
      { visemeIndex: 0, duration: TIMING.shortVowel }, // AH
      { visemeIndex: 10, duration: TIMING.fricative }, // F
      { visemeIndex: 0, duration: TIMING.shortVowel }, // AH
      { visemeIndex: 14, duration: TIMING.liquid }     // L - using velar index
    ]
  },
  {
    name: "lipsync_hello_world",
    description: "Phrase: 'hello world' - Two words combined",
    phonemes: [
      // hello
      { visemeIndex: 12, duration: TIMING.fricative }, // HH (H)
      { visemeIndex: 4, duration: TIMING.shortVowel }, // EH
      { visemeIndex: 14, duration: TIMING.liquid },    // L
      { visemeIndex: 2, duration: TIMING.longVowel },  // OW (Oh)
      // gap
      { visemeIndex: 0, duration: 0.08 },              // Pause (using neutral)
      // world
      { visemeIndex: 7, duration: TIMING.liquid },     // W
      { visemeIndex: 4, duration: TIMING.longVowel },  // ER
      { visemeIndex: 14, duration: TIMING.liquid },    // L
      { visemeIndex: 12, duration: TIMING.plosive }    // D
    ]
  },
  {
    name: "lipsync_thank_you",
    description: "Phrase: 'thank you' - /TH AE NG K  Y UW/",
    phonemes: [
      { visemeIndex: 11, duration: TIMING.fricative }, // TH
      { visemeIndex: 6, duration: TIMING.shortVowel }, // AE
      { visemeIndex: 14, duration: TIMING.nasal },     // NG
      { visemeIndex: 14, duration: TIMING.plosive },   // K
      { visemeIndex: 7, duration: TIMING.liquid },     // Y
      { visemeIndex: 1, duration: TIMING.longVowel }   // UW
    ]
  },
  {
    name: "lipsync_good_morning",
    description: "Phrase: 'good morning' - /G UH D  M AO R N IH NG/",
    phonemes: [
      { visemeIndex: 14, duration: TIMING.plosive },   // G
      { visemeIndex: 1, duration: TIMING.shortVowel }, // UH (using W_OO)
      { visemeIndex: 12, duration: TIMING.plosive },   // D
      { visemeIndex: 13, duration: TIMING.nasal },     // M
      { visemeIndex: 2, duration: TIMING.longVowel },  // AO (Oh)
      { visemeIndex: 7, duration: TIMING.liquid },     // R
      { visemeIndex: 12, duration: TIMING.nasal },     // N
      { visemeIndex: 5, duration: TIMING.shortVowel }, // IH
      { visemeIndex: 14, duration: TIMING.nasal }      // NG
    ]
  },
  {
    name: "lipsync_how_are_you",
    description: "Phrase: 'how are you' - /HH AW  AA R  Y UW/",
    phonemes: [
      { visemeIndex: 12, duration: TIMING.fricative }, // HH (H)
      { visemeIndex: 2, duration: TIMING.longVowel },  // AW (using Oh)
      { visemeIndex: 0, duration: TIMING.shortVowel }, // AA (Ah)
      { visemeIndex: 7, duration: TIMING.liquid },     // R
      { visemeIndex: 7, duration: TIMING.liquid },     // Y
      { visemeIndex: 1, duration: TIMING.longVowel }   // UW
    ]
  }
];

// Generate and save files
const outputDir = path.join(__dirname, '../src/latticework/animation/snippets/visemes');

animations.forEach(anim => {
  const animation = generateAnimation(anim.name, anim.description, anim.phonemes);
  const filePath = path.join(outputDir, `${anim.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(animation, null, 2));
  console.log(`✅ Generated: ${anim.name}.json`);
});

console.log(`\n🎉 Generated ${animations.length} viseme animations with sharp articulation!`);
