import sortBy from 'lodash.sortby';
import { ActionType } from '../actions';
import { Crate } from '../types';

const DEFAULT: State = [];

export type State = Crate[];

export default function crates(state = DEFAULT, action) {
  switch (action.type) {
    case ActionType.CratesLoadSucceeded:
      return sortBy(action.crates, c => c.name);
    default:
      return state;
  }
}
