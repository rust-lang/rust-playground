import * as actions from '../../actions';
import { start, finish } from './sharedStateManagement';

const DEFAULT = {
  requestsInProgress: 0,
};

export default function format(state = DEFAULT, action) {
  switch (action.type) {
  case actions.REQUEST_FORMAT:
    return start(DEFAULT, state);
  case actions.FORMAT_SUCCEEDED:
  case actions.FORMAT_FAILED:
    return finish(state);
  default:
    return state;
  }
}
