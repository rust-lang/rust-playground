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

export default function miri(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.RequestMiri:
      return start(DEFAULT, state);
    case ActionType.MiriSucceeded: {
      const { stdout = '', stderr = '' } = action;
      return finish(state, { stdout, stderr });
    }
    case ActionType.MiriFailed:
      return finish(state, { error: action.error });
    default:
      return state;
  }
}
