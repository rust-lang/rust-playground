import { Action, ActionType } from '../actions';

const DEFAULT: State = `fn main() {
    println!("Hello, world!");
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

    case ActionType.ApplySuggestion:
      const state_lines = state.split('\n');
      const startline = action.startline - 1;
      const endline = action.endline - 1;
      const startcol = action.startcol - 1;
      const endcol = action.endcol - 1;
      if (startline == endline) {
        state_lines[startline] = state_lines[startline].substring(0, startcol) +
          state_lines[startline].substring(endcol);
      } else {
        if (state_lines.length > startline) {
          state_lines[startline] = state_lines[startline].substring(0, startcol);
        }
        if (state_lines.length > endline) {
          state_lines[endline] = state_lines[endline].substring(endcol);
        }
        if (endline - startline > 1) {
          state_lines.splice(startline + 1, endline - startline - 1);
        }
      }
      state_lines[startline] = state_lines[startline].substring(0, startcol) +
        action.suggestion + state_lines[startline].substring(startcol);
      state = state_lines.join('\n');
      return state;

    case ActionType.EnableFeatureGate:
      return `#![feature(${action.featureGate})]\n${state}`;

    case ActionType.FormatSucceeded:
      return action.code;

    default:
      return state;
  }
}
