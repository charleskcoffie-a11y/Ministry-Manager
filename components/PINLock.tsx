
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      
      <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white p-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl transform hover:rotate-6 transition-transform">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Ministry Manager</h1>
          <p className="text-slate-600 text-sm mt-2 font-medium">Enter PIN to Continue</p>
        </div>

        {/* PIN Display */}
        <div className="mb-8 h-12 flex items-center justify-center">
          {error ? (
            <div className={`text-red-500 font-semibold flex items-center gap-2 ${shake ? 'animate-shake' : ''}`}>
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          ) : (
            <div className={`flex gap-4 ${shake ? 'animate-shake' : ''}`}>
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    i < pin.length 
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-600 scale-125 shadow-lg' 
                      : 'bg-slate-200'
                  }`}
                />
              ))}
              {/* If user set a longer PIN > 4, show extra dots dynamically */}
              {pin.length > 4 && [...Array(pin.length - 4)].map((_, i) => (
                 <div key={i+4} className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 scale-125 animate-fade-in shadow-lg" />
              ))}
            </div>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handlePress(num.toString())}
              className="h-16 rounded-2xl bg-white text-2xl font-bold text-slate-700 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:scale-105 active:scale-95 transition-all shadow-md hover:shadow-lg border border-slate-100"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={handleClear}
            className="h-16 rounded-2xl text-slate-500 font-semibold hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center text-sm"
          >
            Clear
          </button>
          
          <button
            onClick={() => handlePress('0')}
            className="h-16 rounded-2xl bg-white text-2xl font-bold text-slate-700 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:scale-105 active:scale-95 transition-all shadow-md hover:shadow-lg border border-slate-100"
          >
            0
          </button>
          
          <button
            onClick={handleBackspace}
            className="h-16 rounded-2xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Unlock Button (Fallback for long pins or manual submit) */}
        <button
          onClick={handleSubmit}
          disabled={pin.length === 0}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Unlock className="w-5 h-5" /> Unlock App
        </button>

      </div>
      
      {/* Helper text */}
      <div className="mt-8 text-slate-600 text-sm text-center bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 relative z-10">
        <p className="font-semibold">Default PIN: {APP_CONSTANTS.DEFAULT_PIN}</p>
        <p className="text-xs text-slate-500 mt-1">Secure Session</p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default PINLock;
