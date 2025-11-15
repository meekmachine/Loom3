import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { EyeHeadTrackingService } from '../latticework/eyeHeadTracking/eyeHeadTrackingService';

interface ModulesContextType {
  isTalking: boolean;
  setIsTalking: (value: boolean) => void;
  isListening: boolean;
  setIsListening: (value: boolean) => void;
  transcribedText: string | null;
  setTranscribedText: (value: string | null) => void;
  speakingText: string | null;
  setSpeakingText: (value: string | null) => void;
  eyeHeadTrackingService: EyeHeadTrackingService | null;
  setEyeHeadTrackingService: (service: EyeHeadTrackingService | null) => void;
}

const ModulesContext = createContext<ModulesContextType | null>(null);

export const useModulesContext = (): ModulesContextType => {
  const context = useContext(ModulesContext);
  if (!context) {
    throw new Error('useModulesContext must be used within a ModulesProvider');
  }
  return context;
};

export const ModulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isTalking, setIsTalking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [eyeHeadTrackingService, setEyeHeadTrackingService] = useState<EyeHeadTrackingService | null>(null);

  const value: ModulesContextType = {
    isTalking,
    setIsTalking,
    isListening,
    setIsListening,
    transcribedText,
    setTranscribedText,
    speakingText,
    setSpeakingText,
    eyeHeadTrackingService,
    setEyeHeadTrackingService,
  };

  return (
    <ModulesContext.Provider value={value}>
      {children}
    </ModulesContext.Provider>
  );
};
