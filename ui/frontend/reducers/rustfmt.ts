import { Action, ActionType } from '../actions';

const DEFAULT: State = {
  show: false,
  toml: '',
}

export type State = {
  show: boolean;
  toml: string;
};

export default function code(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.EditRustfmtToml:
      return {
        ...state, toml: action.code,
      };
    case ActionType.ToggleRustfmtTomlModalShow:
      return {
        ...state, show: !state.show,
      };
    default:
      return state;
  }
}
