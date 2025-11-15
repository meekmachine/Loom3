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
} from '@chakra-ui/react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Bienvenue au Quiz de Vocabulaire Français!</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <p>
            Welcome to the French Vocabulary Quiz! I will ask you the English meaning
            of French words. Please answer by speaking in English.
          </p>
          <p style={{ marginTop: '1rem' }}>
            Make sure your microphone is enabled and working properly.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Start Quiz
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
