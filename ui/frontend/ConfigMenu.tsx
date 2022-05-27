/* global ACE_KEYBINDINGS:false, ACE_THEMES:false */

import React, { Fragment, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { Either as EitherConfig, Select as SelectConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';

import * as actions from './actions';
import State from './state';
import {
  AssemblyFlavor,
  DemangleAssembly,
  Editor,
  Orientation,
  PairCharacters,
  ProcessAssembly,
} from './types';

interface ConfigMenuProps {
  close: () => void;
}

const MONACO_THEMES = [
  'vs', 'vs-dark', 'vscode-dark-plus',
];

const ConfigMenu: React.FC<ConfigMenuProps> = () => {
  const keybinding = useSelector((state: State) => state.configuration.ace.keybinding);
  const aceTheme = useSelector((state: State) => state.configuration.ace.theme);
  const monacoTheme = useSelector((state: State) => state.configuration.monaco.theme);
  const orientation = useSelector((state: State) => state.configuration.orientation);
  const editorStyle = useSelector((state: State) => state.configuration.editor);
  const pairCharacters = useSelector((state: State) => state.configuration.ace.pairCharacters);
  const assemblyFlavor = useSelector((state: State) => state.configuration.assemblyFlavor);
  const demangleAssembly = useSelector((state: State) => state.configuration.demangleAssembly);
  const processAssembly = useSelector((state: State) => state.configuration.processAssembly);

  const dispatch = useDispatch();
  const changeAceTheme = useCallback((t) => dispatch(actions.changeAceTheme(t)), [dispatch]);
  const changeMonacoTheme = useCallback((t) => dispatch(actions.changeMonacoTheme(t)), [dispatch]);
  const changeKeybinding = useCallback((k) => dispatch(actions.changeKeybinding(k)), [dispatch]);
  const changeOrientation = useCallback((o) => dispatch(actions.changeOrientation(o)), [dispatch]);
  const changeEditorStyle = useCallback((e) => dispatch(actions.changeEditor(e)), [dispatch]);
  const changeAssemblyFlavor = useCallback((a) => dispatch(actions.changeAssemblyFlavor(a)), [dispatch]);
  const changePairCharacters = useCallback((p) => dispatch(actions.changePairCharacters(p)), [dispatch]);
  const changeProcessAssembly = useCallback((p) => dispatch(actions.changeProcessAssembly(p)), [dispatch]);
  const changeDemangleAssembly = useCallback((d) => dispatch(actions.changeDemangleAssembly(d)), [dispatch]);

  return (
    <Fragment>
      <MenuGroup title="Editor">
        <SelectConfig
          name="Editor"
          value={editorStyle}
          onChange={changeEditorStyle}
        >
          {[Editor.Simple, Editor.Ace, Editor.Monaco]
            .map(k => <option key={k} value={k}>{k}</option>)}
        </SelectConfig>
        {editorStyle === Editor.Ace && (
          <Fragment>
            <SelectConfig
              name="Keybinding"
              value={keybinding}
              onChange={changeKeybinding}
            >
              {ACE_KEYBINDINGS.map(k => <option key={k} value={k}>{k}</option>)}
            </SelectConfig>

            <SelectConfig
              name="Theme"
              value={aceTheme}
              onChange={changeAceTheme}
            >
              {ACE_THEMES.map(t => <option key={t} value={t}>{t}</option>)}
            </SelectConfig>

            <EitherConfig
              id="editor-pair-characters"
              name="Pair Characters"
              a={PairCharacters.Enabled}
              b={PairCharacters.Disabled}
              value={pairCharacters}
              onChange={changePairCharacters} />
          </Fragment>
        )}
        {editorStyle === Editor.Monaco && (
          <Fragment>
            <SelectConfig
              name="Theme"
              value={monacoTheme}
              onChange={changeMonacoTheme}
            >
              {MONACO_THEMES.map(t => <option key={t} value={t}>{t}</option>)}
            </SelectConfig>
          </Fragment>
        )}
      </MenuGroup>

      <MenuGroup title="UI">
        <SelectConfig
          name="Orientation"
          value={orientation}
          onChange={changeOrientation}
        >
          <option value={Orientation.Automatic}>Automatic</option>
          <option value={Orientation.Horizontal}>Horizontal</option>
          <option value={Orientation.Vertical}>Vertical</option>
        </SelectConfig>
      </MenuGroup>

      <MenuGroup title="Assembly">
        <EitherConfig
          id="assembly-flavor"
          name="Flavor"
          a={AssemblyFlavor.Att}
          b={AssemblyFlavor.Intel}
          aLabel="AT&T"
          bLabel="Intel"
          value={assemblyFlavor}
          onChange={changeAssemblyFlavor} />

        <EitherConfig
          id="assembly-symbols"
          name="Symbol Demangling"
          a={DemangleAssembly.Demangle}
          b={DemangleAssembly.Mangle}
          aLabel="On"
          bLabel="Off"
          value={demangleAssembly}
          onChange={changeDemangleAssembly}
        />

        <EitherConfig
          id="assembly-view"
          name="Name Filtering"
          a={ProcessAssembly.Filter}
          b={ProcessAssembly.Raw}
          aLabel="On"
          bLabel="Off"
          value={processAssembly}
          onChange={changeProcessAssembly}
        />
      </MenuGroup>
    </Fragment>
  );
};

export default ConfigMenu;
