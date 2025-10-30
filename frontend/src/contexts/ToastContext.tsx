import React, { createContext, useContext, useState, useCallback } from 'react';
import { theme } from '../theme';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000): string => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after duration (unless it's a loading toast)
    if (type !== 'loading' && duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, message: string, type: ToastType) => {
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, message, type } : t
    ));

    // If updating to non-loading type, auto-dismiss after default duration
    if (type !== 'loading') {
      setTimeout(() => {
        dismissToast(id);
      }, 3000);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      maxWidth: '400px',
    }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success': return theme.colors.success;
      case 'error': return theme.colors.error;
      case 'loading': return theme.colors.primary.main;
      case 'info':
      default: return theme.colors.text.secondary;
    }
  };

  return (
    <div
      style={{
        backgroundColor: getBackgroundColor(),
        color: 'white',
        padding: '1rem 1.5rem',
        borderRadius: theme.borderRadius.md,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        minWidth: '250px',
        animation: 'slideIn 0.2s ease-out',
        cursor: toast.type !== 'loading' ? 'pointer' : 'default',
      }}
      onClick={() => toast.type !== 'loading' && onDismiss(toast.id)}
    >
      {toast.type === 'loading' && (
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderTop: '2px solid white',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      )}
      <div style={{ flex: 1, fontSize: theme.fontSize.sm }}>
        {toast.message}
      </div>
      {toast.type !== 'loading' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.2rem',
            lineHeight: 1,
            padding: 0,
            opacity: 0.7,
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          ×
        </button>
      )}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
