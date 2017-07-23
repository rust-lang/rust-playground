import * as actions from '../actions';

const DEFAULT = {
  line: 0,
  column: 0,
};

export default function position(state = DEFAULT, action) {
  switch (action.type) {
  case actions.GOTO_POSITION: {
    const { line, column } = action;
    return { ...state, line, column };
  }
  default:
    return state;
  }
}
