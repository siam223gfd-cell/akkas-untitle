import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // default 4000ms
  createdAt: number;
}

interface UIState {
  toasts: ToastItem[];
  isAuthModalOpen: boolean;
  isAdminLoginModalOpen: boolean;
  authModalTab: 'login' | 'register' | 'forgot';
  authRedirectPath?: string;
  quickViewProduct: any | null;
}

const initialState: UIState = {
  toasts: [],
  isAuthModalOpen: false,
  isAdminLoginModalOpen: false,
  authModalTab: 'login',
  quickViewProduct: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    addToast: (
      state,
      action: PayloadAction<{
        type: ToastType;
        title?: string;
        message: string;
        duration?: number;
      }>
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      // Limit to 4 visible toasts max to avoid stacking spam
      if (state.toasts.length >= 4) {
        state.toasts.shift();
      }
      state.toasts.push({
        id,
        type: action.payload.type,
        title: action.payload.title,
        message: action.payload.message,
        duration: action.payload.duration || 4000,
        createdAt: Date.now(),
      });
    },

    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },

    openAuthModal: (
      state,
      action: PayloadAction<{ tab?: 'login' | 'register' | 'forgot'; redirectPath?: string } | undefined>
    ) => {
      state.isAuthModalOpen = true;
      state.authModalTab = action?.payload?.tab || 'login';
      state.authRedirectPath = action?.payload?.redirectPath;
    },

    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
      state.authRedirectPath = undefined;
    },

    openAdminLoginModal: (state) => {
      state.isAdminLoginModalOpen = true;
    },

    closeAdminLoginModal: (state) => {
      state.isAdminLoginModalOpen = false;
    },

    setAuthModalTab: (state, action: PayloadAction<'login' | 'register' | 'forgot'>) => {
      state.authModalTab = action.payload;
    },

    setQuickViewProduct: (state, action: PayloadAction<any | null>) => {
      state.quickViewProduct = action.payload;
    },
  },
});

export const {
  addToast,
  removeToast,
  openAuthModal,
  closeAuthModal,
  openAdminLoginModal,
  closeAdminLoginModal,
  setAuthModalTab,
  setQuickViewProduct,
} = uiSlice.actions;

export default uiSlice.reducer;
