import { Action, ActionType } from '../actions';
import {
  AssemblyFlavor,
  Channel,
  DemangleAssembly,
  Editor,
  Mode,
  Orientation,
  PageMode,
  ProcessAssembly,
} from '../types';

export interface State {
  shown: boolean;
  editor: Editor;
  keybinding: string;
  theme: string;
  orientation: Orientation;
  assemblyFlavor: AssemblyFlavor;
  demangleAssembly: DemangleAssembly;
  processAssembly: ProcessAssembly;
  channel: Channel;
  mode: Mode;
  pageMode: PageMode
}

export const DEFAULT: State = {
  shown: false,
  editor: Editor.Advanced,
  keybinding: 'ace',
  theme: 'github',
  orientation: Orientation.Automatic,
  assemblyFlavor: AssemblyFlavor.Att,
  demangleAssembly: DemangleAssembly.Demangle,
  processAssembly: ProcessAssembly.Filter,
  channel: Channel.Stable,
  mode: Mode.Debug,
  pageMode: PageMode.Normal
};

export default function configuration(state = DEFAULT, action: Action): State {
  switch (action.type) {
  case ActionType.ToggleConfiguration:
    return { ...state, shown: !state.shown };
  case ActionType.ChangePageMode:
    return { ...state, pageMode: action.pageMode };
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
  case ActionType.ChangeProcessAssembly:
    return { ...state, processAssembly: action.processAssembly };
  case ActionType.ChangeChannel:
    return { ...state, channel: action.channel };
  case ActionType.ChangeMode:
    return { ...state, mode: action.mode };
  default:
    return state;
  }
}
