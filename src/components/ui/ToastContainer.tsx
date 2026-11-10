import React, { useEffect, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { removeToast, ToastItem } from '../../features/ui/uiSlice';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastCardProps {
  toast: ToastItem;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast }) => {
  const dispatch = useAppDispatch();
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 4000;
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(duration);

  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    const interval = 25; // 40 updates per second for butter-smooth right-to-left progress

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const timeLeft = remainingTimeRef.current - elapsed;

      if (timeLeft <= 0) {
        clearInterval(timer);
        dispatch(removeToast(toast.id));
      } else {
        const percent = Math.max(0, (timeLeft / duration) * 100);
        setProgress(percent);
      }
    }, interval);

    return () => {
      clearInterval(timer);
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - (Date.now() - startTimeRef.current));
    };
  }, [isPaused, toast.id, duration, dispatch]);

  const getIconAndStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
          border: 'border-emerald-200',
          progressBg: 'bg-emerald-500',
          badgeBg: 'bg-emerald-50 text-emerald-800',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
          border: 'border-rose-200',
          progressBg: 'bg-rose-500',
          badgeBg: 'bg-rose-50 text-rose-800',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          border: 'border-amber-200',
          progressBg: 'bg-amber-500',
          badgeBg: 'bg-amber-50 text-amber-800',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
          border: 'border-blue-200',
          progressBg: 'bg-blue-600',
          badgeBg: 'bg-blue-50 text-blue-800',
        };
    }
  };

  const style = getIconAndStyle();

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`relative overflow-hidden w-84 sm:w-96 bg-white rounded-xl shadow-xl border ${style.border} transition-all duration-200`}
      role="alert"
    >
      <div className="p-4 flex items-start gap-3">
        {style.icon}
        <div className="flex-1 min-w-0">
          {toast.title && <p className="text-sm font-semibold text-slate-900">{toast.title}</p>}
          <p className="text-sm text-slate-600 break-words leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={() => dispatch(removeToast(toast.id))}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mandatory Right-to-Left moving progress bar */}
      <div className="w-full bg-slate-100 h-1 overflow-hidden">
        <div
          className={`h-full ${style.progressBg} transition-all duration-75 ease-linear`}
          style={{
            width: `${progress}%`,
            marginLeft: `${100 - progress}%`, // Moves right-to-left
          }}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useAppSelector((state) => state.ui.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-auto">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
