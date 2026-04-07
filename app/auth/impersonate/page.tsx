'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function ImpersonateContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Preparing impersonation session...');
  const [error, setError] = useState('');

  useEffect(() => {
    const link = searchParams.get('link');
    const adminName = searchParams.get('admin') || 'Admin';
    const targetName = searchParams.get('target') || 'User';
    const targetEmail = searchParams.get('email') || '';

    if (!link) {
      setError('Invalid impersonation link. No login URL provided.');
      return;
    }

    // Store impersonation info in sessionStorage (tab-specific)
    // This will persist through the redirect chain within this tab
    try {
      sessionStorage.setItem(
        'impersonation',
        JSON.stringify({
          active: true,
          adminName,
          targetName,
          targetEmail,
          startedAt: new Date().toISOString(),
        })
      );
    } catch {
      // sessionStorage not available
    }

    setStatus(`Logging in as ${targetName}...`);

    // Small delay to ensure sessionStorage is set, then redirect to magic link
    const timer = setTimeout(() => {
      window.location.href = link;
    }, 500);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error ? (
            <>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Impersonation Error</h2>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button
                onClick={() => window.close()}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm hover:bg-gray-300"
              >
                Close Tab
              </button>
            </>
          ) : (
            <>
              <Loader2 size={32} className="animate-spin text-orange-600 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Admin Impersonation</h2>
              <p className="text-sm text-gray-500">{status}</p>
              <p className="text-xs text-gray-400 mt-3">
                You will be redirected to the admin panel shortly.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <Loader2 size={32} className="animate-spin text-orange-600 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Loading...</h2>
            </div>
          </div>
        </div>
      }
    >
      <ImpersonateContent />
    </Suspense>
  );
}
