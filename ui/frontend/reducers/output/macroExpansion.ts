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

export default function macroExpansion(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.RequestMacroExpansion:
      return start(DEFAULT, state);
    case ActionType.MacroExpansionSucceeded: {
      const { stdout = '', stderr = '' } = action;
      return finish(state, { stdout, stderr });
    }
    case ActionType.MacroExpansionFailed:
      return finish(state, { error: action.error });
    default:
      return state;
  }
}
