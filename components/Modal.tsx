import React from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  confirmText?: string;
  cancelText?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel'
}) => {
  if (!isOpen) return null;

  const icons = {
    info: <Info className="w-6 h-6 text-blue-600" />,
    success: <CheckCircle2 className="w-6 h-6 text-green-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
    error: <AlertCircle className="w-6 h-6 text-red-600" />,
    confirm: <AlertCircle className="w-6 h-6 text-indigo-600" />
  };

  const bgColors = {
    info: 'bg-blue-50',
    success: 'bg-green-50',
    warning: 'bg-yellow-50',
    error: 'bg-red-50',
    confirm: 'bg-indigo-50'
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all scale-100 animate-fade-in">
        {/* Header */}
        <div className={`${bgColors[type]} px-6 py-4 flex items-center gap-3 border-b border-gray-200`}>
          {icons[type]}
          <h3 className="text-lg font-semibold text-gray-900 flex-1">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-gray-700 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end border-t border-gray-200">
          {type === 'confirm' && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
              type === 'error' || type === 'warning' 
                ? 'bg-red-600 hover:bg-red-700' 
                : type === 'success'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
