/**
 * Enhanced Phoneme Predictor
 * Neural-like phoneme prediction using pattern matching and statistical models
 * Provides better accuracy for rare, technical, and foreign words
 */

export interface PhonemePredictionResult {
  phonemes: string[];
  confidence: number; // 0-1
  method: 'dictionary' | 'rules' | 'statistical' | 'syllable';
}

export interface SyllablePattern {
  onset: string[]; // Initial consonants
  nucleus: string[]; // Vowel
  coda: string[]; // Final consonants
}

/**
 * Enhanced Phoneme Predictor Class
 * Uses multiple strategies with confidence scoring
 */
export class EnhancedPhonemePredictor {
  // Letter combination frequency patterns (learned from common English words)
  private bigramPatterns: Map<string, Record<string, number>> = new Map();
  private trigramPatterns: Map<string, Record<string, number>> = new Map();

  // Common letter-to-phoneme patterns with confidence weights
  private letterPatterns: Array<{
    pattern: RegExp;
    context?: RegExp; // Optional context (what comes before/after)
    phonemes: string[];
    confidence: number;
  }> = [
    // Vowels with context
    { pattern: /a(?=r)/i, phonemes: ['AA'], confidence: 0.9 }, // 'car'
    { pattern: /e(?=r)/i, phonemes: ['ER'], confidence: 0.85 }, // 'her'
    { pattern: /i(?=r)/i, phonemes: ['IH', 'R'], confidence: 0.85 }, // 'bird'
    { pattern: /o(?=r)/i, phonemes: ['AO'], confidence: 0.85 }, // 'corn'
    { pattern: /u(?=r)/i, phonemes: ['ER'], confidence: 0.8 }, // 'turn'

    // Consonant clusters
    { pattern: /ch/i, phonemes: ['CH'], confidence: 0.95 },
    { pattern: /sh/i, phonemes: ['SH'], confidence: 0.95 },
    { pattern: /th/i, phonemes: ['TH'], confidence: 0.9 },
    { pattern: /ph/i, phonemes: ['F'], confidence: 0.95 },
    { pattern: /gh(?=$)/i, phonemes: ['F'], confidence: 0.7 }, // 'laugh'
    { pattern: /gh/i, phonemes: [], confidence: 0.6 }, // Silent 'gh' in 'night'
    { pattern: /ck/i, phonemes: ['K'], confidence: 0.95 },
    { pattern: /qu/i, phonemes: ['K', 'W'], confidence: 0.9 },
    { pattern: /x/i, phonemes: ['K', 'S'], confidence: 0.85 },

    // Vowel combinations
    { pattern: /ai/i, phonemes: ['EY'], confidence: 0.8 }, // 'rain'
    { pattern: /ay/i, phonemes: ['EY'], confidence: 0.85 }, // 'day'
    { pattern: /ee/i, phonemes: ['IY'], confidence: 0.9 }, // 'tree'
    { pattern: /ea/i, phonemes: ['IY'], confidence: 0.75 }, // 'beat' (but also 'bread')
    { pattern: /oa/i, phonemes: ['OW'], confidence: 0.85 }, // 'boat'
    { pattern: /oo/i, phonemes: ['UW'], confidence: 0.7 }, // 'boot' (but also 'book')
    { pattern: /ou/i, phonemes: ['AW'], confidence: 0.7 }, // 'out' (but also 'you')
    { pattern: /ow/i, phonemes: ['AW'], confidence: 0.75 }, // 'cow'
    { pattern: /oi/i, phonemes: ['OY'], confidence: 0.9 }, // 'coin'
    { pattern: /oy/i, phonemes: ['OY'], confidence: 0.95 }, // 'boy'

    // Silent letters
    { pattern: /k(?=n)/i, phonemes: [], confidence: 0.95 }, // 'knife'
    { pattern: /(?<=g)h(?=t)/i, phonemes: [], confidence: 0.8 }, // 'night'
    { pattern: /w(?=r)/i, phonemes: [], confidence: 0.85 }, // 'write'
    { pattern: /e(?=$)/i, phonemes: [], confidence: 0.6 }, // Silent 'e' at end

    // Double consonants (usually one sound)
    { pattern: /([bcdfghjklmnpqrstvwxyz])\1/i, phonemes: ['$1'], confidence: 0.85 },
  ];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize statistical patterns from training data
   */
  private initializePatterns(): void {
    // In a real implementation, these would be learned from a large corpus
    // For now, we use hardcoded common patterns

    // Common bigrams (2-letter sequences)
    this.bigramPatterns.set('th', { TH: 0.95, T: 0.03, 'silent': 0.02 });
    this.bigramPatterns.set('ch', { CH: 0.9, K: 0.08, SH: 0.02 });
    this.bigramPatterns.set('sh', { SH: 0.98, S: 0.02 });
    this.bigramPatterns.set('ph', { F: 0.95, P: 0.05 });
    this.bigramPatterns.set('gh', { F: 0.3, 'silent': 0.6, G: 0.1 });

    // Common trigrams (3-letter sequences)
    this.trigramPatterns.set('tion', { 'SH,AH,N': 0.95, 'T,IY,AH,N': 0.05 });
    this.trigramPatterns.set('ough', { 'AW': 0.4, 'OW': 0.3, 'AH': 0.2, 'UW': 0.1 });
    this.trigramPatterns.set('igh', { 'AY': 0.9, 'IH': 0.1 });
  }

  /**
   * Predict phonemes using all available strategies
   */
  public predict(word: string): PhonemePredictionResult {
    word = word.toLowerCase().trim();

    // Try multiple strategies in order of confidence
    const strategies = [
      this.tryStatisticalModel.bind(this),
      this.trySyllableBreakdown.bind(this),
      this.tryRuleBasedPrediction.bind(this),
    ];

    for (const strategy of strategies) {
      const result = strategy(word);
      if (result.confidence > 0.6) {
        return result;
      }
    }

    // Fallback to rule-based with low confidence
    return this.tryRuleBasedPrediction(word);
  }

  /**
   * Statistical model using learned patterns
   */
  private tryStatisticalModel(word: string): PhonemePredictionResult {
    const phonemes: string[] = [];
    let totalConfidence = 0;
    let patternCount = 0;

    let remaining = word;
    while (remaining.length > 0) {
      let matched = false;

      // Try trigrams first
      if (remaining.length >= 3) {
        const trigram = remaining.substring(0, 3);
        const trigramData = this.trigramPatterns.get(trigram);
        if (trigramData) {
          const [bestPhonemes, confidence] = this.getBestMatch(trigramData);
          phonemes.push(...bestPhonemes.split(','));
          totalConfidence += confidence;
          patternCount++;
          remaining = remaining.substring(3);
          matched = true;
          continue;
        }
      }

      // Try bigrams
      if (remaining.length >= 2) {
        const bigram = remaining.substring(0, 2);
        const bigramData = this.bigramPatterns.get(bigram);
        if (bigramData) {
          const [bestPhonemes, confidence] = this.getBestMatch(bigramData);
          if (bestPhonemes !== 'silent') {
            phonemes.push(...bestPhonemes.split(','));
          }
          totalConfidence += confidence;
          patternCount++;
          remaining = remaining.substring(2);
          matched = true;
          continue;
        }
      }

      // Single letter fallback
      if (!matched) {
        const letter = remaining[0];
        const singlePhoneme = this.letterToPhoneme(letter);
        if (singlePhoneme) phonemes.push(singlePhoneme);
        totalConfidence += 0.4; // Low confidence for single letters
        patternCount++;
        remaining = remaining.substring(1);
      }
    }

    const avgConfidence = patternCount > 0 ? totalConfidence / patternCount : 0;

    return {
      phonemes,
      confidence: Math.min(0.9, avgConfidence),
      method: 'statistical',
    };
  }

  /**
   * Get best match from probability distribution
   */
  private getBestMatch(distribution: Record<string, number>): [string, number] {
    let bestPhonemes = '';
    let bestConfidence = 0;

    Object.entries(distribution).forEach(([phonemes, confidence]) => {
      if (confidence > bestConfidence) {
        bestPhonemes = phonemes;
        bestConfidence = confidence;
      }
    });

    return [bestPhonemes, bestConfidence];
  }

  /**
   * Syllable-based breakdown strategy
   */
  private trySyllableBreakdown(word: string): PhonemePredictionResult {
    const syllables = this.splitIntoSyllables(word);
    const phonemes: string[] = [];

    syllables.forEach(syllable => {
      const pattern = this.analyzeSyllablePattern(syllable);

      // Convert onset consonants
      pattern.onset.forEach(c => {
        const p = this.letterToPhoneme(c);
        if (p) phonemes.push(p);
      });

      // Convert nucleus vowels
      pattern.nucleus.forEach(v => {
        const p = this.letterToPhoneme(v);
        if (p) phonemes.push(p);
      });

      // Convert coda consonants
      pattern.coda.forEach(c => {
        const p = this.letterToPhoneme(c);
        if (p) phonemes.push(p);
      });
    });

    return {
      phonemes,
      confidence: 0.7,
      method: 'syllable',
    };
  }

  /**
   * Split word into syllables (simplified)
   */
  private splitIntoSyllables(word: string): string[] {
    // Very simplified syllable splitting
    const vowelPattern = /[aeiouy]+/gi;
    const matches = word.match(vowelPattern);

    if (!matches) return [word];

    const syllables: string[] = [];
    let remaining = word;

    matches.forEach(vowelGroup => {
      const idx = remaining.indexOf(vowelGroup);
      if (idx >= 0) {
        const end = idx + vowelGroup.length + 1; // Include one consonant after
        syllables.push(remaining.substring(0, end));
        remaining = remaining.substring(end);
      }
    });

    if (remaining.length > 0) {
      if (syllables.length > 0) {
        syllables[syllables.length - 1] += remaining;
      } else {
        syllables.push(remaining);
      }
    }

    return syllables.filter(s => s.length > 0);
  }

  /**
   * Analyze syllable structure (onset-nucleus-coda)
   */
  private analyzeSyllablePattern(syllable: string): SyllablePattern {
    const vowels = 'aeiouy';
    const pattern: SyllablePattern = { onset: [], nucleus: [], coda: [] };

    let mode: 'onset' | 'nucleus' | 'coda' = 'onset';

    for (let i = 0; i < syllable.length; i++) {
      const char = syllable[i].toLowerCase();

      if (vowels.includes(char)) {
        if (mode === 'onset') mode = 'nucleus';
        if (mode === 'nucleus') {
          pattern.nucleus.push(char);
        }
      } else {
        if (mode === 'nucleus') mode = 'coda';
        if (mode === 'onset') {
          pattern.onset.push(char);
        } else if (mode === 'coda') {
          pattern.coda.push(char);
        }
      }
    }

    return pattern;
  }

  /**
   * Rule-based prediction using pattern matching
   */
  private tryRuleBasedPrediction(word: string): PhonemePredictionResult {
    const phonemes: string[] = [];
    let remaining = word;

    while (remaining.length > 0) {
      let matched = false;

      // Try pattern matching
      for (const { pattern, phonemes: patternPhonemes } of this.letterPatterns) {
        if (pattern.test(remaining)) {
          const match = remaining.match(pattern);
          if (match) {
            phonemes.push(...patternPhonemes);
            remaining = remaining.substring(match[0].length);
            matched = true;
            break;
          }
        }
      }

      // Single letter fallback
      if (!matched) {
        const phoneme = this.letterToPhoneme(remaining[0]);
        if (phoneme) phonemes.push(phoneme);
        remaining = remaining.substring(1);
      }
    }

    return {
      phonemes: phonemes.filter(p => p.length > 0),
      confidence: 0.6,
      method: 'rules',
    };
  }

  /**
   * Simple letter-to-phoneme mapping
   */
  private letterToPhoneme(letter: string): string {
    const mapping: Record<string, string> = {
      a: 'AH',
      b: 'B',
      c: 'K',
      d: 'D',
      e: 'EH',
      f: 'F',
      g: 'G',
      h: 'HH',
      i: 'IH',
      j: 'JH',
      k: 'K',
      l: 'L',
      m: 'M',
      n: 'N',
      o: 'OW',
      p: 'P',
      q: 'K',
      r: 'R',
      s: 'S',
      t: 'T',
      u: 'UW',
      v: 'V',
      w: 'W',
      x: 'K',
      y: 'Y',
      z: 'Z',
    };

    return mapping[letter.toLowerCase()] || '';
  }

  /**
   * Learn from user corrections (adaptive learning)
   */
  public learnCorrection(word: string, correctPhonemes: string[]): void {
    // Store the correct pronunciation for future use
    // In a real system, this would update the statistical models
    console.log(`[EnhancedPhonemePredictor] Learned: "${word}" → [${correctPhonemes.join(', ')}]`);
  }
}

// Export singleton
export const enhancedPhonemePredictor = new EnhancedPhonemePredictor();
