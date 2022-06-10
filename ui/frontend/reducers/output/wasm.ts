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

export default function wasm(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.CompileWasmRequest:
      return start(DEFAULT, state);
    case ActionType.CompileWasmSucceeded: {
      const { code = '', stdout = '', stderr = '' } = action;
      return finish(state, { code, stdout, stderr });
    }
    case ActionType.CompileWasmFailed:
      return finish(state, { error: action.error });
    default:
      return state;
  }
}
