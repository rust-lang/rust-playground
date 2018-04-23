import * as actions from '../../actions';
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
  case actions.REQUEST_GIST_LOAD:
  case actions.REQUEST_GIST_SAVE:
    return start(DEFAULT, state);

  case actions.GIST_LOAD_SUCCEEDED:
  case actions.GIST_SAVE_SUCCEEDED: {
    const { id, url, channel, mode } = action;
    return finish(state, { id, url, channel, mode });
  }

  case actions.GIST_LOAD_FAILED:
  case actions.GIST_SAVE_FAILED:
    return finish(state, { error: 'Some kind of error' });

  default:
    return state;
  }
}
