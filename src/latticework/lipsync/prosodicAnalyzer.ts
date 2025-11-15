/**
 * Prosodic Analyzer
 * Analyzes text for prosodic features: pitch, stress, emphasis, intonation patterns
 * Generates appropriate facial gestures for natural speech expression
 */

export interface ProsodicFeatures {
  emphasisWords: number[]; // Indices of words to emphasize
  questionIntonation: boolean; // Rising intonation at end
  exclamationEmphasis: boolean; // Strong emphasis
  pausePositions: number[]; // Word indices where pauses should occur
  headGestures: HeadGesture[]; // Head movements for emphasis
  browGestures: BrowGesture[]; // Eyebrow movements
}

export interface HeadGesture {
  wordIndex: number;
  type: 'nod' | 'tilt' | 'turn' | 'shake';
  intensity: number; // 0-1
  duration: number; // seconds
}

export interface BrowGesture {
  wordIndex: number;
  type: 'raise' | 'furrow' | 'flash';
  intensity: number; // 0-1
  duration: number; // seconds
}

export interface StressPattern {
  syllableCount: number;
  stressedSyllables: number[]; // Indices of stressed syllables
  primaryStress: number; // Index of primary stress
}

/**
 * Prosodic Analyzer Class
 * Uses linguistic rules and patterns to detect prosodic features in text
 */
export class ProsodicAnalyzer {
  /**
   * Analyze text for prosodic features
   */
  public analyze(text: string): ProsodicFeatures {
    const words = this.tokenizeWords(text);
    const emphasisWords = this.detectEmphasis(words);
    const questionIntonation = this.isQuestion(text);
    const exclamationEmphasis = this.isExclamation(text);
    const pausePositions = this.detectPauses(text, words);
    const headGestures = this.generateHeadGestures(words, emphasisWords, questionIntonation);
    const browGestures = this.generateBrowGestures(words, emphasisWords, questionIntonation, exclamationEmphasis);

    return {
      emphasisWords,
      questionIntonation,
      exclamationEmphasis,
      pausePositions,
      headGestures,
      browGestures,
    };
  }

  /**
   * Tokenize text into words
   */
  private tokenizeWords(text: string): string[] {
    return text
      .replace(/[.,!?;:]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w.toLowerCase());
  }

  /**
   * Detect words that should be emphasized based on linguistic rules
   */
  private detectEmphasis(words: string[]): number[] {
    const emphasisIndices: number[] = [];

    // Content words (nouns, verbs, adjectives, adverbs) get emphasis
    const contentWordPatterns = [
      // Question words
      /^(what|where|when|who|why|how)$/,
      // Negations
      /^(not|never|no|nothing|nobody|nowhere)$/,
      // Superlatives and comparatives
      /^(most|more|best|better|worst|worse|greatest|largest|smallest)$/,
      // Modal verbs
      /^(must|should|could|would|might|may)$/,
      // Emphasis words
      /^(very|really|quite|extremely|absolutely|definitely|certainly)$/,
      // Numbers (implied stress)
      /^\d+$/,
    ];

    words.forEach((word, idx) => {
      // Check against emphasis patterns
      if (contentWordPatterns.some(pattern => pattern.test(word))) {
        emphasisIndices.push(idx);
      }

      // Long words (>7 chars) typically carry content
      if (word.length > 7 && !this.isFunctionWord(word)) {
        emphasisIndices.push(idx);
      }

      // First and last content words in sentence
      if (idx === 0 || idx === words.length - 1) {
        if (!this.isFunctionWord(word)) {
          emphasisIndices.push(idx);
        }
      }
    });

    // Distribute emphasis naturally (every 3-5 words if no natural emphasis)
    if (emphasisIndices.length < words.length / 5) {
      for (let i = 2; i < words.length; i += 4) {
        if (!emphasisIndices.includes(i)) {
          emphasisIndices.push(i);
        }
      }
    }

    return [...new Set(emphasisIndices)].sort((a, b) => a - b);
  }

  /**
   * Check if word is a function word (articles, pronouns, prepositions)
   */
  private isFunctionWord(word: string): boolean {
    const functionWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
      'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'can', 'could', 'should', 'may', 'might', 'must', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'them', 'their', 'this', 'that', 'these',
      'those', 'my', 'your', 'his', 'her', 'its', 'our',
    ]);
    return functionWords.has(word);
  }

  /**
   * Detect if text is a question
   */
  private isQuestion(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.endsWith('?')) return true;

    // Check for question words at start
    const questionStarts = /^(what|where|when|who|why|how|is|are|do|does|did|can|could|would|should)/i;
    return questionStarts.test(trimmed);
  }

  /**
   * Detect if text has exclamation emphasis
   */
  private isExclamation(text: string): boolean {
    return text.trim().endsWith('!');
  }

  /**
   * Detect natural pause positions (punctuation-based)
   */
  private detectPauses(text: string, words: string[]): number[] {
    const pauses: number[] = [];
    const tokens = text.split(/\s+/);
    let wordIndex = 0;

    tokens.forEach(token => {
      // Check if token ends with punctuation
      if (/[.,;:]/.test(token)) {
        pauses.push(wordIndex);
      }
      if (token.replace(/[.,!?;:]/g, '').length > 0) {
        wordIndex++;
      }
    });

    return pauses;
  }

  /**
   * Generate head gesture patterns based on prosodic features
   */
  private generateHeadGestures(words: string[], emphasisWords: number[], isQuestion: boolean): HeadGesture[] {
    const gestures: HeadGesture[] = [];

    emphasisWords.forEach((wordIdx, i) => {
      // Vary gestures naturally
      const gestureType = this.selectHeadGestureType(i, isQuestion);
      const intensity = 0.6 + Math.random() * 0.3; // 0.6-0.9
      const duration = 0.6 + Math.random() * 0.3; // 0.6-0.9 seconds

      gestures.push({
        wordIndex: wordIdx,
        type: gestureType,
        intensity,
        duration,
      });
    });

    return gestures;
  }

  /**
   * Select appropriate head gesture type based on context
   */
  private selectHeadGestureType(index: number, isQuestion: boolean): HeadGesture['type'] {
    if (isQuestion && index === 0) return 'tilt'; // Tilt on question start

    const types: HeadGesture['type'][] = ['nod', 'tilt', 'turn'];
    const weights = isQuestion ? [0.3, 0.5, 0.2] : [0.6, 0.2, 0.2]; // More tilts for questions

    // Weighted random selection
    const random = Math.random();
    let cumulative = 0;
    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) return types[i];
    }

    return 'nod';
  }

  /**
   * Generate eyebrow gesture patterns
   */
  private generateBrowGestures(
    words: string[],
    emphasisWords: number[],
    isQuestion: boolean,
    isExclamation: boolean
  ): BrowGesture[] {
    const gestures: BrowGesture[] = [];

    emphasisWords.forEach((wordIdx, i) => {
      const gestureType = this.selectBrowGestureType(i, isQuestion, isExclamation);
      const intensity = isExclamation ? 0.7 + Math.random() * 0.3 : 0.4 + Math.random() * 0.3;
      const duration = 0.5 + Math.random() * 0.4; // 0.5-0.9 seconds

      gestures.push({
        wordIndex: wordIdx,
        type: gestureType,
        intensity,
        duration,
      });
    });

    return gestures;
  }

  /**
   * Select appropriate brow gesture type
   */
  private selectBrowGestureType(index: number, isQuestion: boolean, isExclamation: boolean): BrowGesture['type'] {
    if (isQuestion) return 'raise'; // Questions get brow raises
    if (isExclamation) return 'flash'; // Exclamations get quick flashes

    // Alternate between raise and furrow for variety
    return index % 3 === 0 ? 'furrow' : 'raise';
  }

  /**
   * Analyze word stress pattern (basic syllable-based heuristic)
   */
  public analyzeStress(word: string): StressPattern {
    const syllables = this.countSyllables(word);
    const stressedSyllables: number[] = [];

    // Simple heuristic: stress first syllable for short words, second for longer words
    if (syllables === 1) {
      stressedSyllables.push(0);
    } else if (syllables === 2) {
      stressedSyllables.push(0); // First syllable typically stressed in English
    } else {
      stressedSyllables.push(1); // Second syllable for longer words
    }

    return {
      syllableCount: syllables,
      stressedSyllables,
      primaryStress: stressedSyllables[0] || 0,
    };
  }

  /**
   * Count syllables in a word (rough approximation)
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    // Count vowel groups
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);

    return matches ? Math.max(1, matches.length) : 1;
  }

  /**
   * Get pitch contour for sentence (basic intonation pattern)
   */
  public getPitchContour(text: string, words: string[]): number[] {
    const contour: number[] = [];
    const isQuestion = this.isQuestion(text);
    const isExclamation = this.isExclamation(text);

    words.forEach((word, idx) => {
      const position = idx / words.length; // 0 to 1

      if (isQuestion) {
        // Rising intonation for questions
        contour.push(0.5 + position * 0.5); // 0.5 → 1.0
      } else if (isExclamation) {
        // High-low pattern for exclamations
        contour.push(idx === 0 ? 1.0 : 0.5);
      } else {
        // Falling intonation for statements
        contour.push(1.0 - position * 0.3); // 1.0 → 0.7
      }
    });

    return contour;
  }
}

// Export singleton
export const prosodicAnalyzer = new ProsodicAnalyzer();
