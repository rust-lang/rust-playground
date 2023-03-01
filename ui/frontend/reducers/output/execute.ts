import { Action, ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
};

interface State {
  sequenceNumber?: number;
  requestsInProgress: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export default function execute(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.ExecuteRequest:
      return start(DEFAULT, state);
    case ActionType.WSExecuteRequest: {
      const { extra: { sequenceNumber } } = action;
      if (sequenceNumber >= (state.sequenceNumber ?? 0)) {
        const requestsInProgress = 1; // Only tracking one request
        return {...state, sequenceNumber, requestsInProgress };
      } else {
        return state;
      }
    }
    case ActionType.ExecuteSucceeded: {
      const { stdout = '', stderr = '' } = action;
      return finish(state, { stdout, stderr });
    }
    case ActionType.ExecuteFailed: {
      const { error } = action;
      return finish(state, { error });
    }
    case ActionType.WSExecuteResponse: {
      const { stdout, stderr, extra: { sequenceNumber } } = action;

      if (sequenceNumber >= (state.sequenceNumber ?? 0)) {
        const requestsInProgress = 0; // Only tracking one request
        return { ...state, stdout, stderr, requestsInProgress };
      } else {
        return state;
      }
    }
    default:
      return state;
  }
}
