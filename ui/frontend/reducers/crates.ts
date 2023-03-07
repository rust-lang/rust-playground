import { sortBy } from 'lodash-es';

import { Action, ActionType } from '../actions';
import { Crate } from '../types';

const DEFAULT: State = [];

export type State = Crate[];

export default function crates(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.CratesLoadSucceeded:
      return sortBy(action.crates, c => c.name);
    default:
      return state;
  }
}
