import { Action, ActionType } from '../actions';

export interface State {
  baseUrl: string;
  syncChangesToStorage: boolean;
}

const DEFAULT: State = {
  baseUrl: '',
  syncChangesToStorage: true,
};

export default function globalConfiguration(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.DisableSyncChangesToStorage: {
      return { ...state, syncChangesToStorage: false };
    }
    default:
      return state;
  }
}
