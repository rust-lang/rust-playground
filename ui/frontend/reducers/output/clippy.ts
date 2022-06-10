import { Action, ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
};

interface State {
  requestsInProgress: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export default function clippy(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.RequestClippy:
      return start(DEFAULT, state);
    case ActionType.ClippySucceeded: {
      const { stdout = '', stderr = '' } = action;
      return finish(state, { stdout, stderr });
    }
    case ActionType.ClippyFailed:
      return finish(state, { error: action.error });
    default:
      return state;
  }
}
