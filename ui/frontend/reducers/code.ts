import { Action, ActionType } from '../actions';

const DEFAULT: State = `fn main() {
    println!("Hello, world!");
}`;

const EMPTY_MAIN: State = `fn main() {
}`;

export type State = string;

export default function code(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.RequestGistLoad:
      return '';
    case ActionType.GistLoadSucceeded:
      return action.code;

    case ActionType.EditCode:
      return action.code;

    case ActionType.AddMainFunction:
      return `${state}\n\n${DEFAULT}`;

    case ActionType.AddImport:
      return action.code + state;

    case ActionType.EnableFeatureGate:
      return `#![feature(${action.featureGate})]\n${state}`;

    case ActionType.FormatSucceeded:
      return action.code;

    case ActionType.ResetEditorToEmpty:
      return '';

    case ActionType.ResetEditorToMinimal:
      return EMPTY_MAIN;

    case ActionType.ResetEditorToHelloWorld:
      return DEFAULT;

    default:
      return state;
  }
}
