import { useToastStore } from '../store/toastStore.js';

const variantStyles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-slate-200 bg-white text-[#1f1c1a]',
};

const ToastContainer = () => {
  const { toasts, dismissToast } = useToastStore();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-80 flex-col gap-3">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg transition ${
            variantStyles[toast.variant] ?? variantStyles.info
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message && <p className="text-xs text-inherit/80">{toast.message}</p>}
            </div>
            <button
              className="text-xs text-inherit/60 hover:text-inherit"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
