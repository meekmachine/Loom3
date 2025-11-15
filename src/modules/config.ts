import { ModulesConfig } from '../types/modules';

const modulesConfig: ModulesConfig = {
  modules: [
    {
      name: 'French Vocabulary Quiz',
      path: 'frenchQuiz',
      description: 'Practice French vocabulary with voice-based questions and answers',
      settings: {
        autoPlay: true,
        showInstructions: true,
      },
    },
    {
      name: 'AI Chat',
      path: 'aiChat',
      description: 'Conversational AI powered by Claude with emotional expressions via FACS',
      settings: {
        autoEmotion: true,
        emotionIntensity: 1.0,
        anthropicApiKey: localStorage.getItem('anthropic_api_key') || '',
      },
    },
  ],
};

export default modulesConfig;
