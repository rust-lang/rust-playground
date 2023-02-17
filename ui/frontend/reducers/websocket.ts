import { Action, ActionType } from '../actions';

export type State = {
  connected: boolean;
  error?: string;
  featureFlagEnabled: boolean;
};

const DEFAULT: State = {
  connected: false,
  featureFlagEnabled: false,
};

export default function websocket(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.WebSocketConnected:
      return { ...state, connected: true, error: undefined };

    case ActionType.WebSocketDisconnected:
      return { ...state, connected: false };

    case ActionType.WebSocketError:
      return { ...state, error: action.error };

    case ActionType.WebSocketFeatureFlagEnabled:
      return { ...state, featureFlagEnabled: true };

    default:
      return state;
  }
}
