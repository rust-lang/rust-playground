import { Action, ActionType } from '../../actions';
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

export default function execute(state = DEFAULT, action: Action) {
  switch (action.type) {
  case ActionType.ExecuteRequest:
    return start(DEFAULT, state);
  case ActionType.ExecuteSucceeded: {
    const { stdout = "", stderr = "" } = action;
    return finish(state, { stdout, stderr });
  }
  case ActionType.ExecuteFailed:
    return finish(state, { error: action.error });
  default:
    return state;
  }
}
