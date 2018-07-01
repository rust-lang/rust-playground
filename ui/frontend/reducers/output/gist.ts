import { Action, ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
  id: null,
  url: null,
  error: null,
};

export interface State {
  requestsInProgress: number;
  id?: string;
  url?: string;
  error?: string;
}

export default function gist(state = DEFAULT, action) {
  switch (action.type) {
    case ActionType.RequestGistLoad:
    case ActionType.RequestGistSave:
      return start(DEFAULT, state);

    case ActionType.GistLoadSucceeded:
    case ActionType.GistSaveSucceeded: {
      const { id, url, channel, mode, edition } = action;
      return finish(state, { id, url, channel, mode, edition });
    }

    case ActionType.GistLoadFailed:
    case ActionType.GistSaveFailed:
      return finish(state, { error: 'Some kind of error' });

    default:
      return state;
  }
}
