import { Action, ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
  isAutoBuild: false,
};

interface State {
  requestsInProgress: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  isAutoBuild: boolean;
}

export default function execute(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.ExecuteRequest:
      return start(DEFAULT, state);
    case ActionType.ExecuteSucceeded: {
      const { stdout = '', stderr = '', isAutoBuild } = action;
      return finish(state, { stdout, stderr, isAutoBuild });
    }
    case ActionType.ExecuteFailed: {
      const { error, isAutoBuild } = action;
      return finish(state, { error, isAutoBuild });
    }
    default:
      return state;
  }
}
