'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { X, Cookie, Shield, BarChart3, Megaphone, Sparkles, Settings2 } from 'lucide-react';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
}

const STORAGE_KEY = 'snackoh_cookie_consent';

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false,
};

function getStoredConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as CookiePreferences;
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

function saveConsent(preferences: CookiePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* ignore storage errors */
  }
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a3b6b]/50 focus-visible:ring-offset-2
        ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
        ${checked ? 'bg-[#4a3b6b]' : 'bg-gray-300'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
          ring-0 transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

// ─── Preference Row ───────────────────────────────────────────────────────────
function PreferenceRow({
  icon: Icon,
  iconColor,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        {disabled && (
          <span className="inline-block text-[10px] text-[#4a3b6b] font-semibold bg-[#4a3b6b]/10 px-2 py-0.5 rounded-full mt-1.5">
            Always active
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Cookie Consent Component ────────────────────────────────────────────
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);

  // Check localStorage on mount
  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      // Small delay so the banner slides in after page load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    // User already consented, do not show
  }, []);

  const handleClose = useCallback(() => {
    setAnimateOut(true);
    setTimeout(() => {
      setVisible(false);
      setAnimateOut(false);
    }, 300);
  }, []);

  const handleAcceptAll = useCallback(() => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
    };
    saveConsent(allAccepted);
    handleClose();
  }, [handleClose]);

  const handleSavePreferences = useCallback(() => {
    // Necessary cookies are always enabled
    const toSave: CookiePreferences = { ...preferences, necessary: true };
    saveConsent(toSave);
    handleClose();
  }, [preferences, handleClose]);

  const updatePreference = useCallback((key: keyof CookiePreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-[70] p-4 sm:p-6
        flex justify-center
        transition-all duration-300 ease-out
        ${animateOut ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
      `}
      style={{
        animation: !animateOut ? 'slideUpCookie 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined,
      }}
    >
      <style jsx>{`
        @keyframes slideUpCookie {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl shadow-black/15 border border-gray-100 overflow-hidden">
        {/* ── Banner View ── */}
        {!showPreferences && (
          <div className="p-6">
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close cookie banner"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* Icon & Title */}
            <div className="flex items-center gap-2.5 mb-3 pr-8">
              <div className="w-10 h-10 bg-[#4a3b6b]/10 rounded-xl flex items-center justify-center shrink-0">
                <Cookie size={20} className="text-[#4a3b6b]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Accept the use of cookies.</h3>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              We use cookies to enhance your browsing experience, serve personalised content, and
              analyse our traffic. By clicking &quot;Accept all Cookies&quot;, you consent to our use of
              cookies.{' '}
              <Link
                href="/cookie-policy"
                className="text-[#4a3b6b] font-medium underline underline-offset-2 hover:text-[#3a2d57] transition-colors"
              >
                Read our Cookie Policy
              </Link>
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleAcceptAll}
                className="flex-1 py-3 px-5 bg-[#4a3b6b] text-white text-sm font-semibold rounded-xl hover:bg-[#3a2d57] active:scale-[0.98] transition-all duration-150 shadow-sm"
              >
                Accept all Cookies
              </button>
              <button
                onClick={() => setShowPreferences(true)}
                className="flex-1 py-3 px-5 bg-white text-gray-700 text-sm font-semibold rounded-xl border-2 border-gray-200 hover:border-[#4a3b6b] hover:text-[#4a3b6b] active:scale-[0.98] transition-all duration-150"
              >
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Settings2 size={14} />
                  Manage Preferences
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Preferences View ── */}
        {showPreferences && (
          <div className="max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <Shield size={18} className="text-[#4a3b6b]" />
                <h3 className="text-base font-bold text-gray-900">Cookie Preferences</h3>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close cookie preferences"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Description */}
            <div className="px-6 pt-4 pb-2">
              <p className="text-xs text-gray-500 leading-relaxed">
                Choose which cookies you allow. You can change these settings at any time.
                Necessary cookies cannot be disabled as they are essential for the website to
                function properly.
              </p>
            </div>

            {/* Cookie categories */}
            <div className="px-6 divide-y divide-gray-100">
              <PreferenceRow
                icon={Shield}
                iconColor="bg-green-50 text-green-600"
                title="Necessary Cookies"
                description="Essential for the website to function. These cookies ensure basic functionalities like page navigation, secure areas, and shopping cart."
                checked={true}
                onChange={() => {}}
                disabled
              />
              <PreferenceRow
                icon={BarChart3}
                iconColor="bg-blue-50 text-blue-600"
                title="Analytics Cookies"
                description="Help us understand how visitors interact with our website by collecting and reporting information anonymously."
                checked={preferences.analytics}
                onChange={(val) => updatePreference('analytics', val)}
              />
              <PreferenceRow
                icon={Megaphone}
                iconColor="bg-orange-50 text-orange-600"
                title="Marketing Cookies"
                description="Used to track visitors across websites to display relevant advertisements and promotional content."
                checked={preferences.marketing}
                onChange={(val) => updatePreference('marketing', val)}
              />
              <PreferenceRow
                icon={Sparkles}
                iconColor="bg-purple-50 text-purple-600"
                title="Personalization Cookies"
                description="Allow the website to remember your preferences such as language, region, and display settings for a tailored experience."
                checked={preferences.personalization}
                onChange={(val) => updatePreference('personalization', val)}
              />
            </div>

            {/* Footer actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleSavePreferences}
                className="flex-1 py-3 px-5 bg-[#4a3b6b] text-white text-sm font-semibold rounded-xl hover:bg-[#3a2d57] active:scale-[0.98] transition-all duration-150 shadow-sm"
              >
                Save Preferences
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 py-3 px-5 bg-white text-gray-700 text-sm font-semibold rounded-xl border-2 border-gray-200 hover:border-[#4a3b6b] hover:text-[#4a3b6b] active:scale-[0.98] transition-all duration-150"
              >
                Accept All
              </button>
            </div>

            {/* Cookie policy link */}
            <div className="px-6 pb-4 text-center">
              <Link
                href="/cookie-policy"
                className="text-xs text-[#4a3b6b] font-medium underline underline-offset-2 hover:text-[#3a2d57] transition-colors"
              >
                Read our full Cookie Policy
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
