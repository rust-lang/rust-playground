import { Action, ActionType } from '../actions';
import { Page } from '../types';

export type State = Page;

export default function page(state: State = 'index', action: Action) {
  switch (action.type) {
    case ActionType.SetPage:
      return action.page;
    default:
      return state;
  }
}
