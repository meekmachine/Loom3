import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import AIChatApp from './AIChatApp';
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

  // Render the AI Chat app
  root.render(
    <ChakraProvider>
      <ModulesProvider>
        <AIChatApp
          animationManager={animationManager}
          settings={settings}
          toast={toast}
        />
      </ModulesProvider>
    </ChakraProvider>
  );

  toast({
    title: 'AI Chat Started',
    description: 'Conversational AI is now active',
    status: 'success',
    duration: 2000,
  });
}

export function stop(animationManager: any) {
  if (root) {
    root.unmount();
    root = null;
  }

  console.log('AI Chat module stopped');
}
