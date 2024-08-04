import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ThunkAction } from '../actions';
import {
  AssemblyFlavor,
  Backtrace,
  Channel,
  DemangleAssembly,
  Edition,
  Editor,
  Mode,
  Orientation,
  PairCharacters,
  PrimaryAction,
  PrimaryActionAuto,
  ProcessAssembly,
} from '../types';

interface State {
  editor: Editor;
  ace: {
    keybinding: string;
    theme: string;
    pairCharacters: PairCharacters;
  };
  monaco: {
    theme: string;
  };
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

const prefersDarkTheme = window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)').matches
  : false;

const initialState: State = {
  editor: Editor.Ace,
  ace: {
    keybinding: 'ace',
    theme: prefersDarkTheme ? 'github_dark' : 'github',
    pairCharacters: PairCharacters.Enabled,
  },
  monaco: {
    theme: 'vscode-dark-plus',
  },
  orientation: Orientation.Automatic,
  assemblyFlavor: AssemblyFlavor.Att,
  demangleAssembly: DemangleAssembly.Demangle,
  processAssembly: ProcessAssembly.Filter,
  primaryAction: PrimaryActionAuto.Auto,
  channel: Channel.Stable,
  mode: Mode.Debug,
  edition: Edition.Rust2021,
  backtrace: Backtrace.Disabled,
};

const slice = createSlice({
  name: 'configuration',
  initialState,
  reducers: {
    changeAceTheme: (state, action: PayloadAction<string>) => {
      state.ace.theme = action.payload;
    },

    changeAssemblyFlavor: (state, action: PayloadAction<AssemblyFlavor>) => {
      state.assemblyFlavor = action.payload;
    },

    changeBacktrace: (state, action: PayloadAction<Backtrace>) => {
      state.backtrace = action.payload;
    },

    changeChannel: (state, action: PayloadAction<Channel>) => {
      state.channel = action.payload;
    },

    changeDemangleAssembly: (state, action: PayloadAction<DemangleAssembly>) => {
      state.demangleAssembly = action.payload;
    },

    changeEditionRaw: (state, action: PayloadAction<Edition>) => {
      state.edition = action.payload;
    },

    changeEditor: (state, action: PayloadAction<Editor>) => {
      state.editor = action.payload;
    },

    changeKeybinding: (state, action: PayloadAction<string>) => {
      state.ace.keybinding = action.payload;
    },

    changeMode: (state, action: PayloadAction<Mode>) => {
      state.mode = action.payload;
    },

    changeMonacoTheme: (state, action: PayloadAction<string>) => {
      state.monaco.theme = action.payload;
    },

    changeOrientation: (state, action: PayloadAction<Orientation>) => {
      state.orientation = action.payload;
    },

    changePairCharacters: (state, action: PayloadAction<PairCharacters>) => {
      state.ace.pairCharacters = action.payload;
    },

    changePrimaryAction: (state, action: PayloadAction<PrimaryAction>) => {
      state.primaryAction = action.payload;
    },

    changeProcessAssembly: (state, action: PayloadAction<ProcessAssembly>) => {
      state.processAssembly = action.payload;
    },
  },
});

export const {
  changeAceTheme,
  changeAssemblyFlavor,
  changeBacktrace,
  changeChannel,
  changeDemangleAssembly,
  changeEditionRaw,
  changeEditor,
  changeKeybinding,
  changeMode,
  changeMonacoTheme,
  changeOrientation,
  changePairCharacters,
  changePrimaryAction,
  changeProcessAssembly,
} = slice.actions;

export const changeEdition =
  (edition: Edition): ThunkAction =>
  (dispatch) => {
    if (edition === Edition.Rust2024) {
      dispatch(changeChannel(Channel.Nightly));
    }

    dispatch(changeEditionRaw(edition));
  };

export default slice.reducer;
