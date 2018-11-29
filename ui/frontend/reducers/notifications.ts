import { Action, ActionType } from '../actions';
import { Notification } from '../types';

interface State {
  seenRustSurvey2018: boolean; // expired
}

const DEFAULT: State = {
  seenRustSurvey2018: true,
};

export default function notifications(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.NotificationSeen: {
      switch (action.notification) {
      }
    }
    default:
      return state;
  }
}
