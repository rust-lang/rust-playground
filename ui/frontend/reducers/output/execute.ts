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
    case ActionType.WSExecuteRequest:
      return start(DEFAULT, state);
    case ActionType.ExecuteSucceeded: {
      const { stdout = '', stderr = '', isAutoBuild } = action;
      return finish(state, { stdout, stderr, isAutoBuild });
    }
    case ActionType.ExecuteFailed: {
      const { error, isAutoBuild } = action;
      return finish(state, { error, isAutoBuild });
    }
    case ActionType.WSExecuteResponse: {
      const { stdout, stderr, extra: { isAutoBuild } } = action;
      return finish(state, { stdout, stderr, isAutoBuild });
    }
    default:
      return state;
  }
}
