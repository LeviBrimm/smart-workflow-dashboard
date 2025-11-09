import { create } from 'zustand';

let toastCounter = 0;

export const useToastStore = create(set => ({
  toasts: [],
  pushToast: ({ title, message, variant = 'info', duration = 4000 }) => {
    const id = ++toastCounter;
    const toast = { id, title, message, variant };
    set(state => ({ toasts: [...state.toasts, toast] }));
    if (duration !== 0) {
      setTimeout(() => {
        set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  dismissToast: id =>
    set(state => ({
      toasts: state.toasts.filter(toast => toast.id !== id),
    })),
}));
