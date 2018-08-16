import { Action, ActionType } from '../actions';
import {
  AssemblyFlavor,
  Backtrace,
  Channel,
  DemangleAssembly,
  Edition,
  Editor,
  Mode,
  Orientation,
  PrimaryAction,
  PrimaryActionAuto,
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
  primaryAction: PrimaryAction;
  channel: Channel;
  mode: Mode;
  edition: Edition;
  backtrace: Backtrace;
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
  primaryAction: PrimaryActionAuto.Auto,
  channel: Channel.Stable,
  mode: Mode.Debug,
  edition: Edition.Rust2015,
  backtrace: Backtrace.Disabled,
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
    case ActionType.ChangeProcessAssembly:
      return { ...state, processAssembly: action.processAssembly };
    case ActionType.ChangePrimaryAction:
      return { ...state, primaryAction: action.primaryAction };
    case ActionType.ChangeChannel: {
      // Extra logic can be removed when stable understands
      // `cargo-features = ["edition"]`
      let { edition } = state;
      if (action.channel !== Channel.Nightly) {
        edition = Edition.Rust2015;
      }
      return { ...state, channel: action.channel, edition };
    }
    case ActionType.ChangeMode:
      return { ...state, mode: action.mode };
    case ActionType.ChangeEdition: {
      // Extra logic can be removed when stable understands
      // `cargo-features = ["edition"]`
      if (state.channel !== Channel.Nightly) {
        return state;
      }
      return { ...state, edition: action.edition };
    }
    case ActionType.ChangeBacktrace:
      return { ...state, backtrace: action.backtrace };
    default:
      return state;
  }
}
