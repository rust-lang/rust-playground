import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Analysis } from '../rustCodeAnalyzer';
import { FileId } from '../types';
import { deleteFileIds } from './files';

type State = Record<FileId, Analysis>;

const initialState: State = {};

interface SingleUpdate {
  id: FileId;
  analysis: Analysis;
}

const slice = createSlice({
  name: 'codeAnalysis',
  initialState,
  reducers: {
    updateAnalysis: (state, action: PayloadAction<SingleUpdate[]>) => {
      for (const { id, analysis } of action.payload) {
        state[id] = analysis;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(deleteFileIds, (state, action) => {
      for (const id of action.payload) {
        delete state[id];
      }
    });
  },
});

export const { updateAnalysis } = slice.actions;

export default slice.reducer;
