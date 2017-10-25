import * as actions from '../actions';
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
    case actions.VERSIONS_LOAD_SUCCEEDED: {
      const { stable, beta, nightly } = action;
      return { stable, beta, nightly };
    }
    default:
      return state;
  }
}
