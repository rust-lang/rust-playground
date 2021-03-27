import { Action, ActionType } from '../actions';

const DEFAULT: State = {
  isSmall: true,
  ratioGeneration: 0,
};

export type State = {
  isSmall: boolean;
  ratioGeneration: number;
};

export default function code(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.BrowserWidthChanged:
      return { ...state, isSmall: action.isSmall };
    case ActionType.SplitRatioChanged: {
      let { ratioGeneration } = state;
      ratioGeneration++;
      return { ...state, ratioGeneration };
    }

    default:
      return state;
  }
}
