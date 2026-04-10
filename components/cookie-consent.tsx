'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { X, Shield, BarChart3, Megaphone, Sparkles, Settings2, ChevronRight, Lock, Eye } from 'lucide-react';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
}

interface ConsentRecord {
  preferences: CookiePreferences;
  timestamp: string;
  version: string;
  method: 'accept_all' | 'reject_all' | 'custom';
}

const STORAGE_KEY = 'snackoh_cookie_consent';
const CONSENT_VERSION = '1.0';

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false,
};

function getStoredConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ConsentRecord;
      // Check if consent version matches
      if (parsed.version === CONSENT_VERSION) {
        return parsed;
      }
      // Version mismatch — re-consent needed
      return null;
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

function saveConsent(preferences: CookiePreferences, method: ConsentRecord['method']) {
  const record: ConsentRecord = {
    preferences,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
    method,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));

    // Dispatch event so other components can react to consent changes
    window.dispatchEvent(new CustomEvent('cookie-consent-update', { detail: record }));

    // Apply consent decisions
    applyConsentDecisions(preferences);
  } catch {
    /* ignore storage errors */
  }
}

function applyConsentDecisions(preferences: CookiePreferences) {
  // If analytics denied, disable tracking scripts
  if (!preferences.analytics) {
    // Disable GA / analytics cookies
    if (typeof window !== 'undefined') {
      (window as Record<string, unknown>)['ga-disable-GA_MEASUREMENT_ID'] = true;
    }
  }

  // If marketing denied, clear marketing cookies
  if (!preferences.marketing) {
    clearCookiesByPattern(['_fbp', '_gcl', 'ads', 'marketing']);
  }

  // If personalization denied, clear personalization cookies
  if (!preferences.personalization) {
    clearCookiesByPattern(['pref', 'personalization', 'theme_override']);
  }
}

function clearCookiesByPattern(patterns: string[]) {
  if (typeof document === 'undefined') return;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const name = cookie.split('=')[0].trim();
    if (patterns.some(p => name.toLowerCase().includes(p))) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

// Expose a helper to check consent from other components
export function getCookieConsent(): CookiePreferences {
  const stored = getStoredConsent();
  return stored?.preferences || DEFAULT_PREFERENCES;
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
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2
        ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
        ${checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}
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

// ─── Cookie Category Card ────────────────────────────────────────────────────
function CookieCategory({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  cookieCount,
  checked,
  onChange,
  disabled = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  cookieCount: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`group rounded-xl border p-4 transition-all duration-200 ${
      checked
        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50'
    } ${!disabled ? 'hover:shadow-sm' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
              <span className="text-[10px] text-gray-400 font-medium">{cookieCount}</span>
            </div>
            {disabled ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                <Lock size={9} />
                Required
              </span>
            ) : (
              <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
        </div>
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
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
    // Apply stored consent decisions
    applyConsentDecisions(stored.preferences);
  }, []);

  const handleClose = useCallback(() => {
    setAnimateOut(true);
    setTimeout(() => {
      setVisible(false);
      setAnimateOut(false);
    }, 350);
  }, []);

  const handleAcceptAll = useCallback(() => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
    };
    saveConsent(allAccepted, 'accept_all');
    handleClose();
  }, [handleClose]);

  const handleRejectAll = useCallback(() => {
    const essentialOnly: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false,
    };
    saveConsent(essentialOnly, 'reject_all');
    handleClose();
  }, [handleClose]);

  const handleSavePreferences = useCallback(() => {
    const toSave: CookiePreferences = { ...preferences, necessary: true };
    saveConsent(toSave, 'custom');
    handleClose();
  }, [preferences, handleClose]);

  const updatePreference = useCallback((key: keyof CookiePreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-[70] p-3 sm:p-5
        flex justify-center pointer-events-none
        transition-all duration-350 ease-out
        ${animateOut ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
      `}
      style={{
        animation: !animateOut ? 'slideUpCookie 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined,
      }}
    >
      <style jsx>{`
        @keyframes slideUpCookie {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="w-full max-w-xl pointer-events-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-black/20 border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-xl">
        {/* ── Banner View ── */}
        {!showPreferences && (
          <div className="p-5 sm:p-6">
            {/* Close button */}
            <button
              onClick={handleRejectAll}
              className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Reject all and close"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3 mb-4 pr-8">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Your Privacy Matters</h3>
                <p className="text-xs text-gray-400 mt-0.5">Manage how we use cookies on this site</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
              We use cookies to improve your shopping experience, analyze site traffic, and personalize content. You can choose which cookies to allow.{' '}
              <Link
                href="/cookie-policy"
                className="text-emerald-600 font-medium underline underline-offset-2 hover:text-emerald-700 transition-colors inline-flex items-center gap-0.5"
              >
                Cookie Policy <ChevronRight size={12} />
              </Link>
            </p>

            {/* Quick summary chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                <Lock size={10} className="text-emerald-500" />
                Essential (always on)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                <BarChart3 size={10} className="text-blue-500" />
                Analytics
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                <Megaphone size={10} className="text-orange-500" />
                Marketing
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                <Eye size={10} className="text-purple-500" />
                Personalization
              </span>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleAcceptAll}
                className="flex-1 py-3 px-5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 shadow-md shadow-emerald-600/20"
              >
                Accept All
              </button>
              <button
                onClick={handleRejectAll}
                className="flex-1 py-3 px-5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all duration-150"
              >
                Essential Only
              </button>
              <button
                onClick={() => setShowPreferences(true)}
                className="flex-1 py-3 px-5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-emerald-400 hover:text-emerald-600 active:scale-[0.98] transition-all duration-150"
              >
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Settings2 size={14} />
                  Customize
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Preferences View ── */}
        {showPreferences && (
          <div className="max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Back to banner"
                >
                  <ChevronRight size={16} strokeWidth={2.5} className="rotate-180" />
                </button>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Cookie Preferences</h3>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close cookie preferences"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Description */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Choose which cookies you allow. Necessary cookies cannot be disabled as they are required for the site to function. Your selection is saved and can be changed anytime via our Cookie Policy page.
              </p>
            </div>

            {/* Cookie categories */}
            <div className="px-5 py-3 space-y-3">
              <CookieCategory
                icon={Shield}
                iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                iconColor="text-emerald-600"
                title="Essential Cookies"
                description="Required for core site functionality — login sessions, shopping cart, secure checkout, and CSRF protection."
                cookieCount="4 cookies"
                checked={true}
                onChange={() => {}}
                disabled
              />
              <CookieCategory
                icon={BarChart3}
                iconBg="bg-blue-100 dark:bg-blue-900/30"
                iconColor="text-blue-600"
                title="Analytics Cookies"
                description="Help us understand site usage — page views, traffic sources, and user journeys. Data is anonymized."
                cookieCount="3 cookies"
                checked={preferences.analytics}
                onChange={(val) => updatePreference('analytics', val)}
              />
              <CookieCategory
                icon={Megaphone}
                iconBg="bg-orange-100 dark:bg-orange-900/30"
                iconColor="text-orange-600"
                title="Marketing Cookies"
                description="Used for targeted advertisements and promotional campaigns. Shared with advertising partners."
                cookieCount="5 cookies"
                checked={preferences.marketing}
                onChange={(val) => updatePreference('marketing', val)}
              />
              <CookieCategory
                icon={Sparkles}
                iconBg="bg-purple-100 dark:bg-purple-900/30"
                iconColor="text-purple-600"
                title="Personalization Cookies"
                description="Remember your preferences — language, region, display settings, and recently viewed products."
                cookieCount="3 cookies"
                checked={preferences.personalization}
                onChange={(val) => updatePreference('personalization', val)}
              />
            </div>

            {/* Footer actions */}
            <div className="sticky bottom-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 px-5 py-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSavePreferences}
                className="flex-1 py-3 px-5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 shadow-md shadow-emerald-600/20"
              >
                Save My Preferences
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 py-3 px-5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-emerald-400 hover:text-emerald-600 active:scale-[0.98] transition-all duration-150"
              >
                Accept All
              </button>
            </div>

            {/* Cookie policy link */}
            <div className="px-5 pb-4 text-center">
              <Link
                href="/cookie-policy"
                className="text-xs text-emerald-600 font-medium underline underline-offset-2 hover:text-emerald-700 transition-colors"
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
