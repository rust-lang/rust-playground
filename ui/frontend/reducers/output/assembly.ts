import * as actions from '../../actions';
import { start, finish } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
  code: null,
  stdout: null,
  stderr: null,
  error: null,
};

export interface State {
  requestsInProgress: number,
  code?: string,
  stdout?: string,
  stderr?: string,
  error?: string,
}

export default function assembly(state = DEFAULT, action) {
  switch (action.type) {
  case actions.REQUEST_COMPILE_ASSEMBLY:
    return start(DEFAULT, state);
  case actions.COMPILE_ASSEMBLY_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return finish(state, { code, stdout, stderr });
  }
  case actions.COMPILE_ASSEMBLY_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
}
