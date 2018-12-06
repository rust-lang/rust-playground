import { Action, ActionType } from '../actions';
import { Notification } from '../types';

interface State {
  seenRustSurvey2018: boolean; // expired
  seenRust2018IsDefault: boolean;
}

const DEFAULT: State = {
  seenRustSurvey2018: true,
  seenRust2018IsDefault: false,
};

export default function notifications(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.NotificationSeen: {
      switch (action.notification) {
        case Notification.Rust2018IsDefault: {
          return { ...state, seenRust2018IsDefault: true };
        }
      }
    }
    default:
      return state;
  }
}
