import { Action, ActionType } from '../actions';

const DEFAULT: State = `fn main() {
    println!("Hello, world!");
}`;

export type State = string;

export default function code(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.RequestGistLoad:
      return '';
    case ActionType.GistLoadSucceeded:
      return action.code;

    case ActionType.EditCode:
      return action.code;

    case ActionType.FormatSucceeded:
      return action.code;

    default:
      return state;
  }
}
