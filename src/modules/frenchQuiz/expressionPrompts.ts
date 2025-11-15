function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface ExpressionPrompt {
  id: number;
  prompt: string;
  B5T: string;
}

const prompts: ExpressionPrompt[] = [
  {
    id: 1,
    prompt:
      'Show me the face of someone who is happy and appears open to new experiences and shows a high level of imagination. This person should look like they are pondering creative ideas or engaging in a novel task.',
    B5T: 'Openness',
  },
  {
    id: 2,
    prompt:
      'Show me the face of someone who is happy and appears extremely meticulous and organized. This individual should have showing focus and attention to detail, possibly while organizing or planning something.',
    B5T: 'Conscientiousness',
  },
  {
    id: 3,
    prompt:
      'Show me the face of someone who is happy and looks highly sociable and energetic. The expression should be lively with an outgoing personality.',
    B5T: 'Extraversion',
  },
  {
    id: 4,
    prompt:
      'Show me the face of someone who is happy and looks exceedingly warm and empathetic. This person should have a gentle, inviting smile and eyes that convey kindness and a cooperative nature.',
    B5T: 'Agreeableness',
  },
  {
    id: 5,
    prompt:
      'Show me the face of someone who is happy and looks relaxed and unenvious. This person should have a relaxed demeanor, with a composed facial expression that suggests they are in control and unruffled by stress.',
    B5T: 'Emotional Stability',
  },
];

export const expressionPrompts = shuffleArray(prompts);
