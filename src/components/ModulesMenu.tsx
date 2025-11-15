import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Text,
  Switch,
  Tooltip,
  Flex,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Alert,
  AlertIcon,
  useToast,
  Input,
  FormControl,
  FormLabel,
  VStack,
} from '@chakra-ui/react';
import { InfoIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import modulesConfig from '../modules/config';
import { Module, ModuleSettings, ModuleInstance } from '../types/modules';

interface ModulesMenuProps {
  animationManager?: any;
}

export default function ModulesMenu({ animationManager }: ModulesMenuProps) {
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [moduleSettings, setModuleSettings] = useState<Record<string, ModuleSettings>>({});
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Load settings from localStorage or use default from config
  useEffect(() => {
    const initialSettings: Record<string, ModuleSettings> = {};
    modulesConfig.modules.forEach((module) => {
      const storedSettings = localStorage.getItem(module.name);
      initialSettings[module.name] = storedSettings
        ? JSON.parse(storedSettings)
        : { ...module.settings };
    });
    setModuleSettings(initialSettings);
  }, []);

  // Save settings to localStorage
  const saveSettingsToLocalStorage = () => {
    Object.keys(moduleSettings).forEach((moduleName) => {
      localStorage.setItem(moduleName, JSON.stringify(moduleSettings[moduleName]));
    });
  };

  const handleSwitchChange = async (module: Module, isChecked: boolean) => {
    try {
      const moduleInstance = await import(`../modules/${module.path}/index.tsx`) as ModuleInstance;

      if (isChecked) {
        if (!containerRef.current) {
          console.error('Module container reference is invalid. Unable to start the module.');
          setError('Module container reference is invalid. Unable to start the module.');
          return;
        }
        setError('');

        moduleInstance.start(
          animationManager,
          moduleSettings[module.name],
          containerRef,
          toast
        );

        setActiveModules((prev) => ({ ...prev, [module.name]: true }));
      } else {
        moduleInstance.stop(animationManager);
        setActiveModules((prev) => ({ ...prev, [module.name]: false }));
      }
    } catch (err: any) {
      console.error(`Failed to load the module: ${module.name}`, err);
      setError(`Failed to load the module: ${module.name}`);
      toast({
        title: 'Module Error',
        description: `Failed to load ${module.name}`,
        status: 'error',
        duration: 3000,
      });
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      <Box
        position="fixed"
        right="1rem"
        top="1rem"
        bg="gray.850"
        p={4}
        borderRadius="md"
        boxShadow="lg"
        zIndex={1000}
        borderWidth="1px"
        borderColor="gray.700"
      >
        <Flex justify="space-between" align="center">
          <Text fontSize="xl" mb={isMenuOpen ? 4 : 0} color="gray.50" fontWeight="bold">
            Modules
          </Text>
          <IconButton
            icon={isMenuOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            onClick={toggleMenu}
            variant="outline"
            size="sm"
            aria-label="Toggle modules menu"
            colorScheme="brand"
            color="gray.400"
            _hover={{ color: 'gray.200', bg: 'gray.700' }}
          />
        </Flex>

        {error && isMenuOpen && (
          <Alert status="error" mb={4}>
            <AlertIcon />
            {error}
          </Alert>
        )}

        {isMenuOpen && (
          <Accordion allowMultiple>
            {modulesConfig.modules.map((module, index) => (
              <AccordionItem key={index} borderColor="gray.700">
                <AccordionButton bg="gray.800" _hover={{ bg: 'gray.700' }}>
                  <Box flex="1" textAlign="left" color="gray.50">
                    {module.name}
                  </Box>
                  <AccordionIcon color="gray.400" />
                </AccordionButton>
                <AccordionPanel pb={4} bg="gray.800">
                  <VStack align="stretch" spacing={3}>
                    <Flex align="center" justify="space-between">
                      <Tooltip label={module.description} placement="top">
                        <InfoIcon color="gray.400" />
                      </Tooltip>
                      <Switch
                        isChecked={activeModules[module.name] || false}
                        onChange={(e) => handleSwitchChange(module, e.target.checked)}
                        colorScheme="brand"
                      />
                    </Flex>

                    {/* Settings for AI Chat module */}
                    {module.name === 'AI Chat' && (
                      <FormControl>
                        <FormLabel fontSize="sm" color="gray.300">Anthropic API Key</FormLabel>
                        <Input
                          type="password"
                          placeholder="sk-ant-..."
                          size="sm"
                          value={moduleSettings[module.name]?.anthropicApiKey || ''}
                          onChange={(e) => {
                            const newSettings = {
                              ...moduleSettings[module.name],
                              anthropicApiKey: e.target.value,
                            };
                            setModuleSettings({
                              ...moduleSettings,
                              [module.name]: newSettings,
                            });
                            // Save to localStorage immediately
                            localStorage.setItem('anthropic_api_key', e.target.value);
                            localStorage.setItem(module.name, JSON.stringify(newSettings));
                          }}
                          bg="gray.700"
                          borderColor="gray.600"
                          color="gray.50"
                          _hover={{ borderColor: 'gray.500' }}
                          _focus={{ borderColor: 'brand.500', bg: 'gray.700' }}
                        />
                        <Text fontSize="xs" color="gray.400" mt={1}>
                          Get your API key from{' '}
                          <a
                            href="https://console.anthropic.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'underline', color: '#60A5FA' }}
                          >
                            console.anthropic.com
                          </a>
                        </Text>
                      </FormControl>
                    )}
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Box>

      <Box ref={containerRef} id="module-container" />
    </>
  );
}
