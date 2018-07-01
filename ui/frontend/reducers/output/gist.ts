import { Action, ActionType } from '../../actions';
import { Channel, Edition, Mode } from '../../types';
import { finish, RequestsInProgress, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
  id: null,
  url: null,
  error: null,
};

export interface State extends RequestsInProgress {
  id?: string;
  url?: string;
  channel?: Channel;
  mode?: Mode;
  edition?: Edition;
  error?: string;
}

export default function gist(state = DEFAULT, action: Action): State {
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
