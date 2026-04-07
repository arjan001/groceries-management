'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, X, Smartphone, Share, MoreVertical, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// ─── PWA Install Context ──────────────────────────────────────────────────────
// Shared state so that both the floating prompt and the sidebar button
// can trigger the same native install prompt.

interface PwaInstallContextValue {
  canInstall: boolean;
  isInstalled: boolean;
  triggerInstall: () => void;
  showInstructions: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canInstall: false,
  isInstalled: false,
  triggerInstall: () => {},
  showInstructions: () => {},
});

export const usePwaInstall = () => useContext(PwaInstallContext);

// ─── Detect browser for install instructions ──────────────────────────────────

function getBrowserInfo(): { name: string; isMobile: boolean } {
  if (typeof window === 'undefined') return { name: 'unknown', isMobile: false };
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (/CriOS|Chrome/i.test(ua) && !/Edg/i.test(ua)) return { name: 'chrome', isMobile };
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return { name: 'safari', isMobile };
  if (/Edg/i.test(ua)) return { name: 'edge', isMobile };
  if (/Firefox/i.test(ua)) return { name: 'firefox', isMobile };
  return { name: 'other', isMobile };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PwaInstallPrompt({ children }: { children?: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [dismissed, setDismissed] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  // Listen for standalone mode changes and check dismissal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Double-check on mount in case SSR missed it
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) setIsInstalled(true);

    // Check if user previously dismissed
    try {
      const dismissedUntil = localStorage.getItem('pwa_dismissed_until');
      if (dismissedUntil) {
        const until = parseInt(dismissedUntil, 10);
        if (Date.now() < until) {
          setDismissed(true);
        } else {
          localStorage.removeItem('pwa_dismissed_until');
        }
      }
    } catch { /* ignore */ }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallModal(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Register service worker on page load for PWA installability detection
  // Skip registration if app is already installed (standalone mode)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (isInstalled) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => { setSwRegistered(true); })
      .catch((err) => {
        console.error('Service worker registration failed:', err);
      });
  }, [isInstalled]);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallModal(false);
      }
      setDeferredPrompt(null);
    } else {
      // No native prompt available — show manual instructions
      setShowInstallModal(false);
      setShowInstructionsModal(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setShowInstallModal(false);
    // Re-show after 7 days
    try {
      localStorage.setItem('pwa_dismissed_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch { /* ignore */ }
  }, []);

  const canInstall = !isInstalled && (!!deferredPrompt || swRegistered);

  const browserInfo = getBrowserInfo();

  // Auto-show floating modal after 3 seconds for logged-in users
  useEffect(() => {
    if (!isLoggedIn || !canInstall || dismissed || isInstalled) return;
    const timer = setTimeout(() => {
      setShowInstallModal(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoggedIn, canInstall, dismissed, isInstalled]);

  // ── Install Instructions Modal (manual steps) ──
  const instructionsModal = showInstructionsModal && (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowInstructionsModal(false)}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone size={20} className="text-orange-600" />
            <h3 className="text-lg font-bold text-gray-900">Install Snackoh App</h3>
          </div>
          <button onClick={() => setShowInstructionsModal(false)} className="p-1 rounded-full hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Install this app on your device for quick access, offline support, and a native app experience.
        </p>

        {browserInfo.name === 'safari' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Tap the Share button</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <Share size={12} className="inline mr-1" />
                  Located in the browser toolbar {browserInfo.isMobile ? '(bottom center)' : '(top toolbar)'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Select &quot;Add to Home Screen&quot;</p>
                <p className="text-xs text-gray-500 mt-0.5">Scroll down in the share menu to find it</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Tap &quot;Add&quot;</p>
                <p className="text-xs text-gray-500 mt-0.5">The app will appear on your home screen</p>
              </div>
            </div>
          </div>
        ) : browserInfo.name === 'chrome' || browserInfo.name === 'edge' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {browserInfo.isMobile ? 'Tap the menu' : 'Click the install icon'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {browserInfo.isMobile ? (
                    <><MoreVertical size={12} className="inline mr-1" />Three dots menu at the top right</>
                  ) : (
                    <><Download size={12} className="inline mr-1" />Look for the install icon in the address bar (right side)</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {browserInfo.isMobile ? 'Select "Install app" or "Add to Home screen"' : 'Click "Install"'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Follow the on-screen prompts to complete installation</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Open in Chrome or Edge</p>
                <p className="text-xs text-gray-500 mt-0.5">For the best install experience, use Chrome or Edge browser</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Look for the install icon</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <Download size={12} className="inline mr-1" />
                  In the address bar or browser menu
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowInstructionsModal(false)}
          className="mt-5 w-full py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );

  // ── Floating Install Modal ──
  const showFloating = isLoggedIn && canInstall && !dismissed;
  const installModal = showInstallModal && showFloating && (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 sm:p-6" onClick={() => setShowInstallModal(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 pt-6 pb-8 text-white text-center relative">
          <button
            onClick={() => setShowInstallModal(false)}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg mx-auto mb-3 flex items-center justify-center">
            <Monitor size={28} className="text-orange-600" />
          </div>
          <h3 className="text-lg font-bold">Install Snackoh App</h3>
          <p className="text-orange-100 text-sm mt-1">Get the full app experience</p>
        </div>

        {/* Benefits */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
              <Download size={14} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Quick Access</p>
              <p className="text-xs text-gray-500">Launch directly from your home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Smartphone size={14} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Works Offline</p>
              <p className="text-xs text-gray-500">Access your dashboard anytime, anywhere</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <Monitor size={14} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Native Experience</p>
              <p className="text-xs text-gray-500">Feels like a real app on your device</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={handleInstallClick}
            className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-200"
          >
            <Download size={16} strokeWidth={2.5} />
            Install Now
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );

  // ── Small floating trigger button (when modal is closed but install is available) ──
  const floatingButton = showFloating && !showInstallModal && (
    <button
      onClick={() => setShowInstallModal(true)}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-orange-600 text-white pl-4 pr-4 py-3 rounded-full shadow-lg hover:bg-orange-700 transition-all hover:shadow-xl hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-300"
      aria-label="Install App"
    >
      <Download size={16} strokeWidth={2.5} />
      <span className="font-semibold text-sm">Install App</span>
    </button>
  );

  return (
    <PwaInstallContext.Provider value={{ canInstall, isInstalled, triggerInstall: handleInstallClick, showInstructions: () => setShowInstructionsModal(true) }}>
      {children}
      {floatingButton}
      {installModal}
      {instructionsModal}
    </PwaInstallContext.Provider>
  );
}
