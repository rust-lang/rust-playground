import { Action, ActionType } from '../actions';
import {
  AssemblyFlavor,
  Channel,
  DemangleAssembly,
  Editor,
  HideAssemblerDirectives,
  Mode,
  Orientation,
} from '../types';

export interface State {
  shown: boolean;
  editor: Editor;
  keybinding: string;
  theme: string;
  orientation: Orientation;
  assemblyFlavor: AssemblyFlavor;
  demangleAssembly: DemangleAssembly;
  hideAssemblerDirectives: HideAssemblerDirectives;
  channel: Channel;
  mode: Mode;
}

export const DEFAULT: State = {
  shown: false,
  editor: Editor.Advanced,
  keybinding: 'ace',
  theme: 'github',
  orientation: Orientation.Automatic,
  assemblyFlavor: AssemblyFlavor.Att,
  demangleAssembly: DemangleAssembly.Demangle,
  hideAssemblerDirectives: HideAssemblerDirectives.Hide,
  channel: Channel.Stable,
  mode: Mode.Debug,
};

export default function configuration(state = DEFAULT, action: Action): State {
  switch (action.type) {
  case ActionType.ToggleConfiguration:
    return { ...state, shown: !state.shown };
  case ActionType.ChangeEditor:
    return { ...state, editor: action.editor };
  case ActionType.ChangeKeybinding:
    return { ...state, keybinding: action.keybinding };
  case ActionType.ChangeTheme:
    return { ...state, theme: action.theme };
  case ActionType.ChangeOrientation:
    return { ...state, orientation: action.orientation };
  case ActionType.ChangeAssemblyFlavor:
    return { ...state, assemblyFlavor: action.assemblyFlavor };
  case ActionType.ChangeDemangleAssembly:
    return { ...state, demangleAssembly: action.demangleAssembly };
  case ActionType.ChangeHideAssemblerDirectives:
    return { ...state, hideAssemblerDirectives: action.hideAssemblerDirectives };
  case ActionType.ChangeChannel:
    return { ...state, channel: action.channel };
  case ActionType.ChangeMode:
    return { ...state, mode: action.mode };
  default:
    return state;
  }
}
