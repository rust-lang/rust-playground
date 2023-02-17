import { Action, ActionType } from '../actions';

export type State = {
  connected: boolean;
  featureFlagEnabled: boolean;
};

const DEFAULT: State = {
  connected: false,
  featureFlagEnabled: false,
};

export default function websocket(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.WebSocketConnected:
      return { ...state, connected: true };

    case ActionType.WebSocketDisconnected:
      return { ...state, connected: false };

    case ActionType.WebSocketError:
      return { ...state };

    case ActionType.WebSocketFeatureFlagEnabled:
      return { ...state, featureFlagEnabled: true };

    default:
      return state;
  }
}
