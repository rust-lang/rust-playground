import { createSlice } from '@reduxjs/toolkit';

import { makeCompileActions } from '../../compileActions';

const initialState: State = {
  requestsInProgress: 0,
};

interface State {
  requestsInProgress: number;
  code?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

const sliceName = 'output/ast';

export const { action: performCompileAst, performCompile: performCompileToAstOnly } =
  makeCompileActions({ sliceName, target: 'ast' });

const slice = createSlice({
  name: 'output/ast',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(performCompileAst.pending, (state) => {
        state.requestsInProgress += 1;
      })
      .addCase(performCompileAst.fulfilled, (state, action) => {
        const { code, stdout, stderr } = action.payload;
        Object.assign(state, { code, stdout, stderr });
        state.requestsInProgress -= 1;
      })
      .addCase(performCompileAst.rejected, (state, action) => {
        state.error = action.error.message;
        state.requestsInProgress -= 1;
      });
  },
});

export default slice.reducer;
