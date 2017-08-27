import * as actions from '../actions';
import { Position } from '../types';

const DEFAULT: Position = {
  line: 0,
  column: 0,
};

export type State = Position;

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
