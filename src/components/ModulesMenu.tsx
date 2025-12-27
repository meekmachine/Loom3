import { useState, useEffect, useRef, memo } from 'react';
import {
  Box,
  Button,
  IconButton,
  Text,
  Switch,
  Tooltip,
  Flex,
  Accordion,
  Alert,
  Input,
  Field,
  VStack,
} from '@chakra-ui/react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { toaster } from './ui/toaster';
import modulesConfig from '../modules/config';
import { Module, ModuleSettings, ModuleInstance } from '../types/modules';

interface ModulesMenuProps {
  animationManager?: any;
}

function ModulesMenu({ animationManager }: ModulesMenuProps) {
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [moduleSettings, setModuleSettings] = useState<Record<string, ModuleSettings>>({});
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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
          toaster
        );

        setActiveModules((prev) => ({ ...prev, [module.name]: true }));
      } else {
        moduleInstance.stop(animationManager);
        setActiveModules((prev) => ({ ...prev, [module.name]: false }));
      }
    } catch (err: any) {
      console.error(`Failed to load the module: ${module.name}`, err);
      setError(`Failed to load the module: ${module.name}`);
      toaster.error({
        title: 'Module Error',
        description: `Failed to load ${module.name}`,
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
            onClick={toggleMenu}
            variant="outline"
            size="sm"
            aria-label="Toggle modules menu"
            colorPalette="brand"
            color="white"
            _hover={{ color: 'gray.200', bg: 'gray.700' }}
          >
            {isMenuOpen ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
        </Flex>

        {error && isMenuOpen && (
          <Alert.Root status="error" mb={4}>
            <Alert.Indicator />
            <Alert.Content>{error}</Alert.Content>
          </Alert.Root>
        )}

        {isMenuOpen && (
          <Accordion.Root multiple>
            {modulesConfig.modules.map((module, index) => (
              <Accordion.Item key={index} value={module.name} borderColor="gray.700">
                <Accordion.ItemTrigger bg="gray.800" _hover={{ bg: 'gray.700' }}>
                  <Box flex="1" textAlign="left" color="gray.50">
                    {module.name}
                  </Box>
                  <Accordion.ItemIndicator color="white" />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent pb={4} bg="gray.800">
                  <VStack align="stretch" gap={3}>
                    <Flex align="center" justify="space-between">
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <Box as="span" cursor="pointer">
                            <Info size={16} color="gray" />
                          </Box>
                        </Tooltip.Trigger>
                        <Tooltip.Positioner>
                          <Tooltip.Content>{module.description}</Tooltip.Content>
                        </Tooltip.Positioner>
                      </Tooltip.Root>
                      <Switch.Root
                        checked={activeModules[module.name] || false}
                        onCheckedChange={(details) => handleSwitchChange(module, details.checked)}
                        colorPalette="brand"
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                    </Flex>

                    {/* Settings for AI Chat module */}
                    {module.name === 'AI Chat' && (
                      <Field.Root>
                        <Field.Label fontSize="sm" color="white">Anthropic API Key</Field.Label>
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
                        <Text fontSize="xs" color="white" mt={1}>
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
                      </Field.Root>
                    )}
                  </VStack>
                </Accordion.ItemContent>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        )}
      </Box>

      <Box ref={containerRef} id="module-container" />
    </>
  );
}

export default memo(ModulesMenu);
