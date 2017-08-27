import sortBy from 'lodash.sortby';
import * as actions from '../actions';

const DEFAULT = [];

export default function crates(state = DEFAULT, action) {
  switch (action.type) {
  case actions.CRATES_LOAD_SUCCEEDED:
    return sortBy(action.crates, c => c.name);
  default:
    return state;
  }
}
