import { Button } from '@/components/ui/button';
import {
  ApiError,
  requestAccessCode,
  verifyAccessCode,
} from '@/services/apiService';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  useCallback,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_DIGITS = ['', '', '', '', '', ''];

type AccessCodeGateProps = {
  onAuthenticated: (email: string, code: string) => void;
};

export function AccessCodeGate({ onAuthenticated }: AccessCodeGateProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(EMPTY_DIGITS);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);

  const resetDigits = useCallback(() => {
    setDigits(EMPTY_DIGITS);
    digitRefs.current[0]?.focus();
  }, []);

  const handleVerify = useCallback(
    async (code: string) => {
      setVerifying(true);
      setError(null);
      try {
        await verifyAccessCode(normalizedEmail, code);
        onAuthenticated(normalizedEmail, code);
      } catch (e) {
        resetDigits();
        setError(
          e instanceof ApiError
            ? e.message
            : 'Verification code is invalid or expired',
        );
      } finally {
        setVerifying(false);
      }
    },
    [normalizedEmail, onAuthenticated, resetDigits],
  );

  const handleRequestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!emailValid || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await requestAccessCode(normalizedEmail);
      setStep('code');
      setDigits(EMPTY_DIGITS);
      queueMicrotask(() => digitRefs.current[0]?.focus());
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Failed to send verification code',
      );
    } finally {
      setLoading(false);
    }
  };

  const updateDigit = (index: number, value: string) => {
    if (verifying || !/^\d?$/.test(value)) {
      return;
    }

    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(null);

    if (value && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }

    const code = next.join('');
    if (code.length === 6 && next.every((d) => d !== '')) {
      void handleVerify(code);
    }
  };

  const handleDigitKeyDown = (index: number, event: KeyboardEvent) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pasted) {
      return;
    }

    const next = pasted
      .split('')
      .concat(Array(6).fill(''))
      .slice(0, 6) as string[];
    setDigits(next);
    setError(null);

    if (pasted.length === 6) {
      void handleVerify(pasted);
    } else {
      digitRefs.current[pasted.length]?.focus();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          AI Inference Evaluator
        </p>

        {step === 'email' ? (
          <form onSubmit={handleRequestCode} className="mt-8 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in with email
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email to receive a verification code.
              </p>
            </div>

            <input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!emailValid || loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Next <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Enter verification code
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent the verification code to{' '}
                <span className="font-medium text-foreground">
                  {normalizedEmail}
                </span>
                .
              </p>
            </div>

            <div className="flex justify-between gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    digitRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  disabled={verifying}
                  aria-label={`Digit ${index + 1}`}
                  onChange={(e) => updateDigit(index, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="h-12 w-full rounded-lg border border-border bg-background text-center text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
              ))}
            </div>

            {verifying && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </p>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setDigits(EMPTY_DIGITS);
                setError(null);
              }}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Use a different email
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
