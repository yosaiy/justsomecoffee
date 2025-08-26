import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { verifyPin } from '../lib/supabase';

interface LoginProps {
  onLogin: (success: boolean) => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(() => {
    const stored = localStorage.getItem('loginAttempts');
    return stored ? JSON.parse(stored) : { count: 0, timestamp: 0 };
  });

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setPin(value);
      setError(false);
    }
  };

  const isLocked = () => {
    if (attempts.count >= MAX_ATTEMPTS) {
      const timeElapsed = Date.now() - attempts.timestamp;
      if (timeElapsed < LOCKOUT_TIME) {
        return true;
      }
      // Reset attempts after lockout period
      setAttempts({ count: 0, timestamp: 0 });
      localStorage.setItem('loginAttempts', JSON.stringify({ count: 0, timestamp: 0 }));
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked()) {

      setError(true);
      setPin('');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyPin(pin);
      if (isValid) {
        // Clear attempts on successful login
        setAttempts({ count: 0, timestamp: 0 });
        localStorage.setItem('loginAttempts', JSON.stringify({ count: 0, timestamp: 0 }));
        localStorage.setItem('isAuthenticated', 'true');
        onLogin(true);
      } else {
        // Increment attempts on failed login
        const newAttempts = {
          count: attempts.count + 1,
          timestamp: attempts.count + 1 >= MAX_ATTEMPTS ? Date.now() : attempts.timestamp
        };
        setAttempts(newAttempts);
        localStorage.setItem('loginAttempts', JSON.stringify(newAttempts));
        setError(true);
        setPin('');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-amber-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Just Some Coffee</h1>
          <p className="text-gray-600 mt-1">Enter PIN to access dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={handlePinChange}
                placeholder="Enter 6-digit PIN"
                className={`w-full px-4 py-3 text-center text-2xl tracking-widest border ${
                  error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                maxLength={6}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 text-center">
                {isLocked() 
                  ? `Too many failed attempts. Please try again in ${Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.timestamp)) / 60000)} minutes.`
                  : `Incorrect PIN. ${MAX_ATTEMPTS - attempts.count} attempts remaining.`
                }
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pin.length !== 6 || loading || isLocked()}
            className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium
                     hover:bg-amber-700 transition-colors
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
