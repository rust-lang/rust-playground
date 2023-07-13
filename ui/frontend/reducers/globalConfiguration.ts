import { createSlice } from '@reduxjs/toolkit';

interface State {
  baseUrl: string;
  syncChangesToStorage: boolean;
}

const initialState: State = {
  baseUrl: '',
  syncChangesToStorage: true,
};

const slice = createSlice({
  name: 'globalConfiguration',
  initialState,
  reducers: {
    disableSyncChangesToStorage: (state) => {
      state.syncChangesToStorage = false;
    },
  },
});

export const { disableSyncChangesToStorage } = slice.actions;

export default slice.reducer;
