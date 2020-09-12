import { Action, ActionType } from '../actions';
import { Notification } from '../types';

interface State {
  seenRustSurvey2018: boolean; // expired
  seenRust2018IsDefault: boolean; // expired
  seenRustSurvey2020: boolean;
}

const DEFAULT: State = {
  seenRustSurvey2018: true,
  seenRust2018IsDefault: true,
  seenRustSurvey2020: false,
};

export default function notifications(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.NotificationSeen: {
      switch (action.notification) {
        case Notification.RustSurvey2020: {
          return { ...state, seenRustSurvey2020: true };
        }
      }
    }
    default:
      return state;
  }
}
