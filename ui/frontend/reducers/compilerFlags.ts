import * as actions from '../actions';

const DEFAULT: State = '';

export type State = string;

export default function compilerFlags(state = DEFAULT, action) {
  switch (action.type) {
  case actions.EDIT_COMPILER_FLAGS:
    return action.compilerFlags;
  default:
    return state;
  }
}
