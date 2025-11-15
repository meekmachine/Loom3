/**
 * Test Utilities for Lip-Sync Animation System
 * Provides comprehensive testing, validation, and debugging tools
 */

import { PhonemeExtractor } from './PhonemeExtractor';
import { VisemeMapper } from './VisemeMapper';
import { getARKitVisemeKey, getARKitVisemeIndex, getJawAmountForViseme } from './visemeToARKit';

export interface TestResult {
  passed: boolean;
  message: string;
  details?: any;
}

export interface LipSyncTestSuite {
  testPhonemeExtraction: () => TestResult[];
  testVisemeMapping: () => TestResult[];
  testARKitConversion: () => TestResult[];
  testCoarticulation: () => TestResult[];
  testTimingAccuracy: () => TestResult[];
  runAllTests: () => { total: number; passed: number; failed: number; results: TestResult[] };
}

/**
 * Create a comprehensive test suite for lip-sync system
 */
export function createLipSyncTestSuite(): LipSyncTestSuite {
  const phonemeExtractor = new PhonemeExtractor();
  const visemeMapper = new VisemeMapper();

  /**
   * Test phoneme extraction from various texts
   */
  function testPhonemeExtraction(): TestResult[] {
    const results: TestResult[] = [];

    // Test 1: Basic word
    const hello = phonemeExtractor.extractPhonemes('hello');
    results.push({
      passed: hello.length > 0,
      message: 'Extract phonemes from "hello"',
      details: { phonemes: hello, count: hello.length }
    });

    // Test 2: Complex sentence
    const sentence = phonemeExtractor.extractPhonemes('The quick brown fox jumps over the lazy dog.');
    results.push({
      passed: sentence.length > 20,
      message: 'Extract phonemes from complex sentence',
      details: { phonemes: sentence, count: sentence.length }
    });

    // Test 3: Punctuation handling
    const withPunctuation = phonemeExtractor.extractPhonemes('Hello, world!');
    const hasPause = withPunctuation.some(p => p.startsWith('PAUSE'));
    results.push({
      passed: hasPause,
      message: 'Handle punctuation with pauses',
      details: { phonemes: withPunctuation, hasPause }
    });

    // Test 4: Technical terms
    const technical = phonemeExtractor.extractPhonemes('DoubleMetaphone algorithm');
    results.push({
      passed: technical.length > 0,
      message: 'Extract phonemes from technical terms',
      details: { phonemes: technical, count: technical.length }
    });

    // Test 5: Numbers and special characters
    const mixed = phonemeExtractor.extractPhonemes('Hello 123!');
    results.push({
      passed: mixed.length > 0,
      message: 'Handle mixed alphanumeric input',
      details: { phonemes: mixed }
    });

    return results;
  }

  /**
   * Test viseme mapping accuracy
   */
  function testVisemeMapping(): TestResult[] {
    const results: TestResult[] = [];

    // Test 1: Vowel phonemes map to correct visemes
    const vowelPhonemes = ['AE', 'AA', 'IY', 'UW', 'OW'];
    const vowelTests = vowelPhonemes.map(phoneme => {
      const mapping = visemeMapper.getVisemeAndDuration(phoneme);
      return {
        passed: mapping.viseme >= 1 && mapping.viseme <= 11,
        message: `Vowel ${phoneme} maps to viseme ${mapping.viseme}`,
        details: mapping
      };
    });
    results.push(...vowelTests);

    // Test 2: Consonant phonemes map correctly
    const consonantPhonemes = ['P', 'B', 'M', 'S', 'Z', 'T', 'D'];
    const consonantTests = consonantPhonemes.map(phoneme => {
      const mapping = visemeMapper.getVisemeAndDuration(phoneme);
      return {
        passed: mapping.viseme >= 12 && mapping.viseme <= 21,
        message: `Consonant ${phoneme} maps to viseme ${mapping.viseme}`,
        details: mapping
      };
    });
    results.push(...consonantTests);

    // Test 3: Duration differences between vowels and consonants
    const vowelDuration = visemeMapper.getVisemeAndDuration('AA').duration;
    const consonantDuration = visemeMapper.getVisemeAndDuration('P').duration;
    results.push({
      passed: vowelDuration > consonantDuration,
      message: 'Vowels have longer duration than consonants',
      details: { vowelDuration, consonantDuration }
    });

    // Test 4: Pause tokens
    const pauseMapping = visemeMapper.getVisemeAndDuration('PAUSE_COMMA');
    results.push({
      passed: pauseMapping.viseme === 0 && pauseMapping.duration > 0,
      message: 'Pause tokens map to silence with duration',
      details: pauseMapping
    });

    return results;
  }

  /**
   * Test ARKit conversion and jaw mapping
   */
  function testARKitConversion(): TestResult[] {
    const results: TestResult[] = [];

    // Test 1: All SAPI visemes map to valid ARKit indices
    for (let sapiId = 0; sapiId <= 21; sapiId++) {
      const arkitIndex = getARKitVisemeIndex(sapiId);
      const arkitKey = getARKitVisemeKey(sapiId);
      const jawAmount = getJawAmountForViseme(sapiId);

      results.push({
        passed: arkitIndex >= 0 && arkitIndex <= 14 && jawAmount >= 0 && jawAmount <= 1,
        message: `SAPI ${sapiId} → ARKit index ${arkitIndex} (${arkitKey}), jaw ${jawAmount.toFixed(2)}`,
        details: { sapiId, arkitIndex, arkitKey, jawAmount }
      });
    }

    // Test 2: Bilabial consonants (P, B, M) have minimal jaw
    const bilabialJaw = getJawAmountForViseme(21); // P-B-M
    results.push({
      passed: bilabialJaw === 0,
      message: 'Bilabial consonants (P, B, M) have zero jaw activation',
      details: { bilabialJaw }
    });

    // Test 3: Open vowels (AA) have maximum jaw
    const openVowelJaw = getJawAmountForViseme(2); // AA
    results.push({
      passed: openVowelJaw >= 0.8,
      message: 'Open vowels (AA) have high jaw activation',
      details: { openVowelJaw }
    });

    return results;
  }

  /**
   * Test coarticulation behavior
   */
  function testCoarticulation(): TestResult[] {
    const results: TestResult[] = [];

    // Simulate adjacent visemes
    const word = 'hello';
    const phonemes = phonemeExtractor.extractPhonemes(word);
    const visemes = visemeMapper.mapPhonemesToVisemes(phonemes);

    // Test 1: Adjacent visemes exist
    results.push({
      passed: visemes.length >= 2,
      message: 'Word produces multiple visemes for coarticulation',
      details: { word, visemeCount: visemes.length, visemes }
    });

    // Test 2: Timing overlap is possible
    let totalDuration = 0;
    visemes.forEach(v => {
      totalDuration += v.duration;
    });
    results.push({
      passed: totalDuration > 0,
      message: 'Total viseme duration is positive',
      details: { totalDuration, average: totalDuration / visemes.length }
    });

    // Test 3: Check for variety in visemes (not all the same)
    const uniqueVisemes = new Set(visemes.map(v => v.viseme));
    results.push({
      passed: uniqueVisemes.size > 1,
      message: 'Word produces varied visemes (not monotone)',
      details: { uniqueCount: uniqueVisemes.size, unique: Array.from(uniqueVisemes) }
    });

    return results;
  }

  /**
   * Test timing accuracy and performance
   */
  function testTimingAccuracy(): TestResult[] {
    const results: TestResult[] = [];

    // Test 1: Phoneme extraction performance
    const longText = 'The saddest aspect of life right now is that science gathers knowledge faster than society gathers wisdom.'.repeat(5);
    const startTime = performance.now();
    const phonemes = phonemeExtractor.extractPhonemes(longText);
    const extractTime = performance.now() - startTime;

    results.push({
      passed: extractTime < 50, // Should complete in < 50ms
      message: `Phoneme extraction performance: ${extractTime.toFixed(2)}ms for ${phonemes.length} phonemes`,
      details: { extractTime, phonemeCount: phonemes.length, text: longText }
    });

    // Test 2: Viseme mapping performance
    const mapStartTime = performance.now();
    const visemes = visemeMapper.mapPhonemesToVisemes(phonemes);
    const mapTime = performance.now() - mapStartTime;

    results.push({
      passed: mapTime < 20, // Should complete in < 20ms
      message: `Viseme mapping performance: ${mapTime.toFixed(2)}ms for ${visemes.length} visemes`,
      details: { mapTime, visemeCount: visemes.length }
    });

    // Test 3: ARKit conversion performance
    const arkitStartTime = performance.now();
    visemes.forEach(v => {
      getARKitVisemeIndex(v.viseme);
      getJawAmountForViseme(v.viseme);
    });
    const arkitTime = performance.now() - arkitStartTime;

    results.push({
      passed: arkitTime < 10, // Should complete in < 10ms
      message: `ARKit conversion performance: ${arkitTime.toFixed(2)}ms for ${visemes.length} conversions`,
      details: { arkitTime, conversionCount: visemes.length }
    });

    // Test 4: Total latency
    const totalLatency = extractTime + mapTime + arkitTime;
    results.push({
      passed: totalLatency < 100, // Total should be < 100ms
      message: `Total lip-sync latency: ${totalLatency.toFixed(2)}ms (target: <100ms)`,
      details: { totalLatency, breakdown: { extractTime, mapTime, arkitTime } }
    });

    return results;
  }

  /**
   * Run all tests and return summary
   */
  function runAllTests() {
    const allResults: TestResult[] = [
      ...testPhonemeExtraction(),
      ...testVisemeMapping(),
      ...testARKitConversion(),
      ...testCoarticulation(),
      ...testTimingAccuracy(),
    ];

    const passed = allResults.filter(r => r.passed).length;
    const failed = allResults.filter(r => !r.passed).length;

    return {
      total: allResults.length,
      passed,
      failed,
      results: allResults
    };
  }

  return {
    testPhonemeExtraction,
    testVisemeMapping,
    testARKitConversion,
    testCoarticulation,
    testTimingAccuracy,
    runAllTests
  };
}

/**
 * Validate animation snippet structure
 */
export function validateAnimationSnippet(snippet: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!snippet.name) errors.push('Missing snippet name');
  if (!snippet.curves || typeof snippet.curves !== 'object') errors.push('Missing or invalid curves object');
  if (typeof snippet.maxTime !== 'number' || snippet.maxTime <= 0) errors.push('Invalid maxTime');
  if (snippet.snippetCategory === undefined) errors.push('Missing snippetCategory');
  if (typeof snippet.snippetPriority !== 'number') errors.push('Invalid snippetPriority');

  // Validate curves
  if (snippet.curves) {
    Object.entries(snippet.curves).forEach(([curveId, keyframes]: [string, any]) => {
      if (!Array.isArray(keyframes)) {
        errors.push(`Curve "${curveId}" is not an array`);
        return;
      }

      keyframes.forEach((kf: any, idx: number) => {
        if (typeof kf.time !== 'number') errors.push(`Curve "${curveId}" keyframe ${idx}: missing time`);
        if (typeof kf.intensity !== 'number') errors.push(`Curve "${curveId}" keyframe ${idx}: missing intensity`);
        if (kf.intensity < 0 || kf.intensity > 100) errors.push(`Curve "${curveId}" keyframe ${idx}: intensity out of range (0-100)`);
      });

      // Check keyframes are sorted
      for (let i = 0; i < keyframes.length - 1; i++) {
        if (keyframes[i].time > keyframes[i + 1].time) {
          errors.push(`Curve "${curveId}" keyframes not sorted by time`);
          break;
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate test report
 */
export function generateTestReport(testSuite: LipSyncTestSuite): string {
  const results = testSuite.runAllTests();
  const lines: string[] = [];

  lines.push('=== LIP-SYNC SYSTEM TEST REPORT ===\n');
  lines.push(`Total Tests: ${results.total}`);
  lines.push(`Passed: ${results.passed} ✓`);
  lines.push(`Failed: ${results.failed} ✗`);
  lines.push(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);

  lines.push('\n=== DETAILED RESULTS ===\n');
  results.results.forEach((result, idx) => {
    const status = result.passed ? '✓' : '✗';
    lines.push(`${idx + 1}. ${status} ${result.message}`);
    if (result.details && !result.passed) {
      lines.push(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  });

  return lines.join('\n');
}

/**
 * Export test utilities for console/debugging
 */
export const LipSyncTestUtils = {
  createTestSuite: createLipSyncTestSuite,
  validateSnippet: validateAnimationSnippet,
  generateReport: generateTestReport,
};

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).LipSyncTestUtils = LipSyncTestUtils;
}
