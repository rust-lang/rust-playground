import { Action, ActionType } from '../actions';
import { Notification } from '../types';

interface State {
  seenRustSurvey2018: boolean; // expired
  seenRust2018IsDefault: boolean; // expired
  seenRustSurvey2020: boolean; // expired
  seenRust2021IsDefault: boolean;
  seenRustSurvey2021: boolean;
}

const DEFAULT: State = {
  seenRustSurvey2018: true,
  seenRust2018IsDefault: true,
  seenRustSurvey2020: true,
  seenRust2021IsDefault: false,
  seenRustSurvey2021: false,
};

export default function notifications(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.NotificationSeen: {
      switch (action.notification) {
        case Notification.Rust2021IsDefault: {
          return { ...state, seenRust2021IsDefault: true };
        }
        case Notification.RustSurvey2021: {
          return { ...state, seenRustSurvey2021: true };
        }
      }
    }
    default:
      return state;
  }
}
