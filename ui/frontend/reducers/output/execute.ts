import { Action, ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
  stdin: null,
  stdout: null,
  stderr: null,
  error: null,
  isAutoBuild: false,
};

interface State {
  requestsInProgress: number;
  stdout?: string;
  stdin?: string;
  stderr?: string;
  error?: string;
  isAutoBuild: boolean;
}

export default function execute(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.ExecuteRequest:
      return start(DEFAULT, state);
    case ActionType.ExecuteSucceeded: {
      const { stdin, stdout = '', stderr = '', isAutoBuild } = action;
      return finish(state, { stdin, stdout, stderr, isAutoBuild });
    }
    case ActionType.ExecuteFailed: {
      const { stdin, error, isAutoBuild } = action;
      return finish(state, { stdin, error, isAutoBuild });
    }
    default:
      return state;
  }
}
