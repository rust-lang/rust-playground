import { Action, ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
};

interface State {
  requestsInProgress: number;
  code?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export default function llvmIr(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.CompileLlvmIrRequest:
      return start(DEFAULT, state);
    case ActionType.CompileLlvmIrSucceeded: {
      const { code = '', stdout = '', stderr = '' } = action;
      return finish(state, { code, stdout, stderr });
    }
    case ActionType.CompileLlvmIrFailed:
      return finish(state, { error: action.error });
    default:
      return state;
  }
}
