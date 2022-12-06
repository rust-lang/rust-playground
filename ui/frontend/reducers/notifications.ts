import { Action, ActionType } from '../actions';
import { Notification } from '../types';

interface State {
  seenRustSurvey2018: boolean; // expired
  seenRust2018IsDefault: boolean; // expired
  seenRustSurvey2020: boolean; // expired
  seenRust2021IsDefault: boolean; // expired
  seenRustSurvey2021: boolean; // expired
  seenMonacoEditorAvailable: boolean; // expired
  seenRustSurvey2022: boolean;
}

const DEFAULT: State = {
  seenRustSurvey2018: true,
  seenRust2018IsDefault: true,
  seenRustSurvey2020: true,
  seenRust2021IsDefault: true,
  seenRustSurvey2021: true,
  seenMonacoEditorAvailable: true,
  seenRustSurvey2022: false,
};

export default function notifications(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.NotificationSeen: {
      switch (action.notification) {
        case Notification.RustSurvey2022: {
          return { ...state, seenRustSurvey2022: true };
        }
      }
    }
    default:
      return state;
  }
}
