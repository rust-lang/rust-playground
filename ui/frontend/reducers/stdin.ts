import { Action, ActionType } from "../actions";

export type State = string;

export default function stdin(state = "", action: Action): State {
    switch (action.type) {
        case ActionType.EditStdin:
            return action.stdin;
        default:
            return state;
    }
}