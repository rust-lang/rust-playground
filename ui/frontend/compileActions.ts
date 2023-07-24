import { AsyncThunk, createAsyncThunk } from '@reduxjs/toolkit';

import { SimpleThunkAction, adaptFetchError, jsonPost, routes } from './actions';
import { compileRequestPayloadSelector } from './selectors';

interface CompileRequestBody {
  channel: string;
  mode: string;
  crateType: string;
  tests: boolean; // Used?
  code: string;
  edition: string;
  backtrace: boolean; // Used?
  target: string;
  assemblyFlavor: string;
  demangleAssembly: string;
  processAssembly: string;
}

interface CompileResponseBody {
  code: string;
  stdout: string;
  stderr: string;
}

interface Props {
  sliceName: string;
  target: string;
}

interface CompileActions {
  action: AsyncThunk<CompileResponseBody, CompileRequestBody, {}>;
  performCompile: () => SimpleThunkAction;
}

export const makeCompileActions = ({ sliceName, target }: Props): CompileActions => {
  const action = createAsyncThunk(sliceName, async (payload: CompileRequestBody) =>
    adaptFetchError(() => jsonPost<CompileResponseBody>(routes.compile, payload)),
  );

  const performCompile = (): SimpleThunkAction => (dispatch, getState) => {
    const state = getState();
    const body = compileRequestPayloadSelector(state, { target });
    dispatch(action(body));
  };

  return { action, performCompile };
};
