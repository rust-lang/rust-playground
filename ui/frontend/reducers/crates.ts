import sortBy from 'lodash.sortby';
import * as actions from '../actions';
import { Crate } from '../types';

const DEFAULT: State = [];

export type State = Crate[];

export default function crates(state = DEFAULT, action) {
  switch (action.type) {
  case actions.CRATES_LOAD_SUCCEEDED:
    return sortBy(action.crates, c => c.name);
  default:
    return state;
  }
}
