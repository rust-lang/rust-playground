import { Action, ActionType } from '../actions';
import { Selection } from '../types';

const DEFAULT: Selection = {
};

export default function position(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.SelectText: {
      const { start, end } = action;
      return { ...state, start, end };
    }
    default:
      return state;
  }
}
