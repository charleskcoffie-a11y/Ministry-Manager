import { useState, useCallback } from 'react';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  onConfirm?: () => void;
}

export const useModal = () => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title?: string) => {
    const titles = {
      info: 'Information',
      success: 'Success',
      warning: 'Warning',
      error: 'Error'
    };
    
    setModalState({
      isOpen: true,
      title: title || titles[type],
      message,
      type
    });
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void, title: string = 'Confirm Action') => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        onConfirm: () => {
          onConfirm();
          resolve(true);
        }
      });
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    modalState,
    showAlert,
    showConfirm,
    closeModal
  };
};
