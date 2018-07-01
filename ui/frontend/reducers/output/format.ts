import { ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
};

export interface State {
  requestsInProgress: number;
}

export default function format(state = DEFAULT, action) {
  switch (action.type) {
    case ActionType.RequestFormat:
      return start(DEFAULT, state);
    case ActionType.FormatSucceeded:
    case ActionType.FormatFailed:
      return finish(state);
    default:
      return state;
  }
}
