import { ActionType } from '../actions';
import { Version } from '../types';

const DEFAULT: State = {
  stable: null,
  beta: null,
  nightly: null,
};

export interface State {
  stable?: Version;
  beta?: Version;
  nightly?: Version;
}

export default function crates(state = DEFAULT, action) {
  switch (action.type) {
    case ActionType.VersionsLoadSucceeded: {
      const { stable, beta, nightly } = action;
      return { stable, beta, nightly };
    }
    default:
      return state;
  }
}
