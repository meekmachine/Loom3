import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import FrenchQuizApp from './FrenchQuizApp';
import { ModuleSettings } from '../../types/modules';
import { ModulesProvider } from '../../context/ModulesContext';

let root: ReactDOM.Root | null = null;

export function start(
  animationManager: any,
  settings: ModuleSettings,
  containerRef: React.RefObject<HTMLDivElement>,
  toast: any
) {
  if (!containerRef.current) {
    console.error('Container ref is invalid');
    toast({
      title: 'Error',
      description: 'Module container not found',
      status: 'error',
      duration: 3000,
    });
    return;
  }

  // Create root if it doesn't exist
  if (!root) {
    root = ReactDOM.createRoot(containerRef.current);
  }

  // Render the French Quiz app
  root.render(
    <ChakraProvider>
      <ModulesProvider>
        <FrenchQuizApp
          animationManager={animationManager}
          settings={settings}
          toast={toast}
        />
      </ModulesProvider>
    </ChakraProvider>
  );

  toast({
    title: 'French Quiz Started',
    description: 'Savoir-Faire Quiz is now active',
    status: 'success',
    duration: 2000,
  });
}

export function stop(animationManager: any) {
  if (root) {
    root.unmount();
    root = null;
  }

  console.log('French Quiz module stopped');
}
