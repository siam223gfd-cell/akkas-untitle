import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, UserAddress } from '../../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isSessionChecking: boolean;
  isLoading: boolean;
  error: string | null;
}

const getStoredToken = () => {
  try {
    return localStorage.getItem('novara_token');
  } catch {
    return null;
  }
};

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('novara_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const token = getStoredToken();
const user = getStoredUser();
const isInitialAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

const initialState: AuthState = {
  user,
  token,
  isAuthenticated: !!token && !!user,
  isSessionChecking: Boolean(token) || isInitialAdminPath,
  isLoading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSessionChecking: (state, action: PayloadAction<boolean>) => {
      state.isSessionChecking = action.payload;
    },
    hydrateUser: (state, action: PayloadAction<{ user: User; token?: string | null }>) => {
      state.user = action.payload.user;
      if (action.payload.token) {
        state.token = action.payload.token;
      }
      state.isAuthenticated = true;
      state.isSessionChecking = false;
      state.error = null;
      try {
        localStorage.setItem('novara_user', JSON.stringify(action.payload.user));
        if (action.payload.token) {
          localStorage.setItem('novara_token', action.payload.token);
        }
      } catch (e) {
        console.error(e);
      }
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isSessionChecking = false;
      state.error = null;
      try {
        localStorage.setItem('novara_token', action.payload.token);
        localStorage.setItem('novara_user', JSON.stringify(action.payload.user));
      } catch (e) {
        console.error(e);
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isSessionChecking = false;
      state.error = null;
      try {
        localStorage.removeItem('novara_token');
        localStorage.removeItem('novara_user');
      } catch (e) {
        console.error(e);
      }
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        try {
          localStorage.setItem('novara_user', JSON.stringify(state.user));
        } catch (e) {
          console.error(e);
        }
      }
    },
    updateAddresses: (state, action: PayloadAction<UserAddress[]>) => {
      if (state.user) {
        state.user.addresses = action.payload;
        try {
          localStorage.setItem('novara_user', JSON.stringify(state.user));
        } catch (e) {
          console.error(e);
        }
      }
    },
  },
});

export const {
  setSessionChecking,
  hydrateUser,
  loginSuccess,
  logout,
  updateUser,
  updateAddresses,
} = authSlice.actions;
export const setCredentials = loginSuccess;
export default authSlice.reducer;
