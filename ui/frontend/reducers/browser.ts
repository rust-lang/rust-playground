import { Action, ActionType } from '../actions';

const DEFAULT: State = {
  isSmall: true,
};

export type State = {
  isSmall: boolean;
};

export default function code(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.BrowserWidthChanged:
      return { ...state, isSmall: action.isSmall };

    default:
      return state;
  }
}
