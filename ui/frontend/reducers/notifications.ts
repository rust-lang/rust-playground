import { Action, ActionType } from '../actions';
import { Notification } from '../types';

interface State {
  seenRustSurvey2018: boolean;
}

const DEFAULT: State = {
  seenRustSurvey2018: false,
};

export default function notifications(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.NotificationSeen: {
      switch (action.notification) {
        case Notification.RustSurvey2018: {
          return { ...state, seenRustSurvey2018: true };
        }
      }
    }
    default:
      return state;
  }
}
