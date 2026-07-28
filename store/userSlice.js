import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState: {
    user: null,
    userDetails: null,
    authReady: false,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload
        ? {
            uid: action.payload.uid || null,
            email: action.payload.email || null,
            displayName: action.payload.displayName || null,
            photoURL: action.payload.photoURL || null,
          }
        : null;
    },
    setUserDetails(state, action) {
      state.userDetails = action.payload;
    },
    setAuthReady(state, action) {
      state.authReady = action.payload;
    },
    logout(state) {
      state.user = null;
      state.userDetails = null;
      state.authReady = true;
    },
  },
});

export const { setUser, setUserDetails, setAuthReady, logout } = userSlice.actions;
export default userSlice.reducer;
