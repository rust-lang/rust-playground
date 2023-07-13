import { PayloadAction, createSlice } from '@reduxjs/toolkit';

interface State {
  id: string;
  featureFlagThreshold: number;
}

const initialState: State = {
  id: '',
  featureFlagThreshold: 1.0,
};

const slice = createSlice({
  name: 'client',
  initialState,
  reducers: {
    setIdentifiers: (
      state,
      action: PayloadAction<{ id: string; featureFlagThreshold: number }>,
    ) => {
      state.id = action.payload.id;
      state.featureFlagThreshold = action.payload.featureFlagThreshold;
    },
  },
});

export const { setIdentifiers: clientSetIdentifiers } = slice.actions;

export default slice.reducer;
