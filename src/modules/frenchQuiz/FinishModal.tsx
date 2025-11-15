import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
} from '@chakra-ui/react';

interface FinishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FinishModal({ isOpen, onClose }: FinishModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Quiz Complete!</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            Thank you for completing the Savoir-Faire Quiz! Your responses have
            been recorded.
          </Text>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="green" onClick={onClose}>
            Finish
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
