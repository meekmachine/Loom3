import { UseToastOptions } from '@chakra-ui/react';

export interface ModuleSettings {
  [key: string]: any;
}

export interface Module {
  name: string;
  path: string;
  description: string;
  settings: ModuleSettings;
}

export interface ModulesConfig {
  modules: Module[];
}

export interface ModuleInstance {
  start: (
    animationManager: any,
    settings: ModuleSettings,
    containerRef: React.RefObject<HTMLDivElement>,
    toast: (options: UseToastOptions) => void
  ) => void;
  stop: (animationManager: any) => void;
}
