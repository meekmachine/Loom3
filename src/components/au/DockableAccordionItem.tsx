import React, { useState, useRef } from 'react';
import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  HStack,
  Portal,
  IconButton,
  Text
} from '@chakra-ui/react';
import Draggable from 'react-draggable';
import { CloseIcon, DragHandleIcon } from '@chakra-ui/icons';

interface DockableAccordionItemProps {
  title: string;
  isDefaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * DockableAccordionItem - Accordion item that can be undocked into a draggable window
 */
// Track panel count for positioning
let panelCount = 0;
// Track highest z-index for bringing panels to front
let highestZIndex = 100000;

function DockableAccordionItem({
  title,
  isDefaultExpanded = false,
  children
}: DockableAccordionItemProps) {
  const [isDocked, setIsDocked] = useState(true);
  const [isExpanded, setIsExpanded] = useState(isDefaultExpanded);
  const [zIndex, setZIndex] = useState(() => highestZIndex++);

  // Calculate initial position based on panel index
  const [panelIndex] = useState(() => panelCount++);
  const [pos, setPos] = useState(() => {
    const baseX = 100;
    const baseY = 80;
    const offsetX = (panelIndex % 3) * 350; // 3 columns
    const offsetY = Math.floor(panelIndex / 3) * 280; // Stack vertically after 3
    return { x: baseX + offsetX, y: baseY + offsetY };
  });

  const dragRef = useRef<HTMLDivElement>(null);

  // Bring panel to front when clicked
  const bringToFront = () => {
    setZIndex(++highestZIndex);
  };

  const handleStop = (_e: any, data: { x: number; y: number }) => {
    setPos({ x: data.x, y: data.y });
  };

  // If docked => standard Chakra Accordion usage
  if (isDocked) {
    return (
      <AccordionItem border="none" borderBottom="1px solid" borderColor="gray.700">
        <h2>
          <AccordionButton
            onClick={() => setIsExpanded(!isExpanded)}
            bg="gray.750"
            color="gray.50"
            _hover={{ bg: 'gray.700' }}
            _expanded={{ bg: 'gray.700', borderBottom: '2px solid', borderColor: 'brand.500' }}
            py={3}
          >
            <Box flex="1" textAlign="left" fontWeight="semibold">
              {title}
            </Box>

            <HStack
              spacing={2}
              _hover={{ '.drag-trigger': { opacity: 1, visibility: 'visible' } }}
            >
              <Box
                className="drag-trigger"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                w="24px"
                h="24px"
                opacity={0}
                visibility="hidden"
                cursor="pointer"
                color="brand.400"
                transition="all 0.2s"
                _hover={{ color: 'brand.300', transform: 'scale(1.1)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDocked(false);
                }}
              >
                <DragHandleIcon boxSize={4} />
              </Box>

              <AccordionIcon color="gray.400" />
            </HStack>
          </AccordionButton>
        </h2>
        {isExpanded && (
          <AccordionPanel pb={4} pt={4} bg="gray.800">
            {children}
          </AccordionPanel>
        )}
      </AccordionItem>
    );
  }

  // If undocked => render in a draggable Portal
  return (
    <Portal>
      <Draggable
        nodeRef={dragRef}
        position={pos}
        onStop={handleStop}
        handle=".drag-handle"
        onStart={bringToFront}
      >
        <Box
          ref={dragRef}
          position="fixed"
          top={0}
          left={0}
          zIndex={zIndex}
          w="340px"
          minW="280px"
          maxW="600px"
          minH="180px"
          maxH="70vh"
          bg="gray.800"
          border="2px solid"
          borderColor="brand.500"
          borderRadius="lg"
          boxShadow="dark-lg"
          sx={{ resize: 'both', overflow: 'auto' }}
          onClick={bringToFront}
          transition="border-color 0.2s, box-shadow 0.2s"
          _hover={{
            borderColor: 'brand.400',
            boxShadow: '0 0 20px rgba(23, 174, 230, 0.4)',
          }}
        >
          <Box
            className="drag-handle"
            bg="gray.700"
            p={3}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            borderTopRadius="lg"
            cursor="move"
            borderBottom="1px solid"
            borderColor="gray.600"
          >
            <Text fontWeight="bold" color="gray.50">{title}</Text>
            <IconButton
              size="xs"
              aria-label="Dock item"
              icon={<CloseIcon />}
              onClick={() => setIsDocked(true)}
              colorScheme="gray"
              variant="ghost"
              _hover={{ bg: 'gray.600' }}
            />
          </Box>

          <Box p={4} color="gray.50">
            {children}
          </Box>
        </Box>
      </Draggable>
    </Portal>
  );
}

export default DockableAccordionItem;
