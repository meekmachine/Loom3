function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface Question {
  id: number;
  text: string;
  options: string[];
  B5T: string;
}

const questionsList: Question[] = [
  {
    id: 4,
    text: 'This person seems like they would enjoy exploring new ideas.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Openness',
  },
  {
    id: 5,
    text: 'This individual appears to be imaginative.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Openness',
  },
  {
    id: 6,
    text: 'This person looks like they plan ahead.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Conscientiousness',
  },
  {
    id: 7,
    text: 'This individual seems to be reliable in important situations.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Conscientiousness',
  },
  {
    id: 8,
    text: 'This person likely enjoys social gatherings.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Extraversion',
  },
  {
    id: 9,
    text: 'This individual seems to be the life of the party.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Extraversion',
  },
  {
    id: 10,
    text: 'This person appears to be warm and friendly.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Agreeableness',
  },
  {
    id: 11,
    text: 'This individual seems like they are easy to get along with.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Agreeableness',
  },
  {
    id: 12,
    text: 'This person appears calm under pressure.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Emotional Stability',
  },
  {
    id: 13,
    text: 'This individual seems to handle stressful situations well.',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    B5T: 'Emotional Stability',
  },
];

export const questions = shuffleArray(questionsList);
