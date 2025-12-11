
import React, { useState, useEffect } from 'react';
import { Lock, Delete, ChevronRight, Unlock, AlertCircle } from 'lucide-react';
import { APP_CONSTANTS } from '../constants';

interface PINLockProps {
  onUnlock: () => void;
}

const PINLock: React.FC<PINLockProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  // Default PIN from constants if not set in local storage
  const getStoredPin = () => localStorage.getItem('ministryAppPIN') || APP_CONSTANTS.DEFAULT_PIN;

  const handlePress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = () => {
    const storedPin = getStoredPin();
    if (pin === storedPin) {
      onUnlock();
    } else {
      setError('Incorrect PIN');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
  };

  // Auto-submit if PIN length matches stored PIN length (UX enhancement)
  useEffect(() => {
    const storedPin = getStoredPin();
    if (pin.length === storedPin.length) {
      // Small delay to let user see the last dot fill
      const timer = setTimeout(() => {
        if (pin === storedPin) {
          onUnlock();
        } else {
          setError('Incorrect PIN');
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setPin('');
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pin, onUnlock]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 p-8">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Ministry Manager</h1>
          <p className="text-slate-500 text-sm mt-1">Enter PIN to Unlock</p>
        </div>

        {/* PIN Display */}
        <div className="mb-8 h-12 flex items-center justify-center">
          {error ? (
            <div className={`text-red-500 font-medium flex items-center gap-2 animate-bounce`}>
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : (
            <div className={`flex gap-4 ${shake ? 'animate-shake' : ''}`}>
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    i < pin.length 
                      ? 'bg-slate-800 scale-110' 
                      : 'bg-slate-200'
                  }`}
                />
              ))}
              {/* If user set a longer PIN > 4, show extra dots dynamically */}
              {pin.length > 4 && [...Array(pin.length - 4)].map((_, i) => (
                 <div key={i+4} className="w-4 h-4 rounded-full bg-slate-800 scale-110 animate-fade-in" />
              ))}
            </div>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handlePress(num.toString())}
              className="h-16 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-700 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-100"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={handleClear}
            className="h-16 rounded-2xl text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center"
          >
            Clear
          </button>
          
          <button
            onClick={() => handlePress('0')}
            className="h-16 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-700 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-100"
          >
            0
          </button>
          
          <button
            onClick={handleBackspace}
            className="h-16 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Unlock Button (Fallback for long pins or manual submit) */}
        <button
          onClick={handleSubmit}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
        >
          <Unlock className="w-5 h-5" /> Unlock App
        </button>

      </div>
      
      {/* Helper text */}
      <p className="mt-8 text-slate-400 text-xs text-center">
        Default PIN: {APP_CONSTANTS.DEFAULT_PIN}<br/>
        Secure Session Active
      </p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};

export default PINLock;
