import * as actions from '../../actions';
import { start, finish } from './sharedStateManagement';

const DEFAULT = {
  requestsInProgress: 0,
  stdout: null,
  stderr: null,
  error: null,
};

export default function clippy(state = DEFAULT, action) {
  switch (action.type) {
  case actions.REQUEST_CLIPPY:
    return start(DEFAULT, state);
  case actions.CLIPPY_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return finish(state, { stdout, stderr });
  }
  case actions.CLIPPY_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
}
