'use client';

import { Toast, ToastType } from '@/lib/hooks';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-yellow-500 text-white',
};

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right ${typeStyles[toast.type]}`}
        >
          <span className="text-lg font-bold">{typeIcons[toast.type]}</span>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="opacity-70 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
