import * as actions from '../../actions';
import { start, finish } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
  stdout: null,
  stderr: null,
  error: null,
};

export interface State {
  requestsInProgress: number,
  stdout?: string,
  stderr?: string,
  error?: string,
}

export default function execute(state = DEFAULT, action) {
  switch (action.type) {
  case actions.REQUEST_EXECUTE:
    return start(DEFAULT, state);
  case actions.EXECUTE_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return finish(state, { stdout, stderr });
  }
  case actions.EXECUTE_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
}
