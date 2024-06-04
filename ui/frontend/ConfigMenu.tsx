/* global ACE_KEYBINDINGS:false, ACE_THEMES:false */

import React, { Fragment, useCallback } from 'react';

import { Either as EitherConfig, Select as SelectConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import { useAppDispatch, useAppSelector } from './hooks';

import * as config from './reducers/configuration';
import {
  AssemblyFlavor,
  CargoScript,
  Channel,
  DemangleAssembly,
  Editor,
  Orientation,
  PairCharacters,
  ProcessAssembly,
} from './types';
import { shallowEqual } from 'react-redux';

const MONACO_THEMES = [
  'vs', 'vs-dark', 'vscode-dark-plus',
];

const ConfigMenu: React.FC = () => {
  const keybinding = useAppSelector((state) => state.configuration.ace.keybinding);
  const aceTheme = useAppSelector((state) => state.configuration.ace.theme);
  const monacoTheme = useAppSelector((state) => state.configuration.monaco.theme);
  const orientation = useAppSelector((state) => state.configuration.orientation);
  const editorStyle = useAppSelector((state) => state.configuration.editor);
  const pairCharacters = useAppSelector((state) => state.configuration.ace.pairCharacters);
  const assemblyFlavor = useAppSelector((state) => state.configuration.assemblyFlavor);
  const demangleAssembly = useAppSelector((state) => state.configuration.demangleAssembly);
  const processAssembly = useAppSelector((state) => state.configuration.processAssembly);
  const cargoScript = useAppSelector((state) => state.configuration.cargoScript);
  const isNightly = useAppSelector((state) => state.configuration.channel === Channel.Nightly, shallowEqual);

  const dispatch = useAppDispatch();
  const changeAceTheme = useCallback((t: string) => dispatch(config.changeAceTheme(t)), [dispatch]);
  const changeMonacoTheme = useCallback((t: string) => dispatch(config.changeMonacoTheme(t)), [dispatch]);
  const changeKeybinding = useCallback((k: string) => dispatch(config.changeKeybinding(k)), [dispatch]);
  const changeOrientation = useCallback((o: Orientation) => dispatch(config.changeOrientation(o)), [dispatch]);
  const changeEditorStyle = useCallback((e: Editor) => dispatch(config.changeEditor(e)), [dispatch]);
  const changeAssemblyFlavor =
    useCallback((a: AssemblyFlavor) => dispatch(config.changeAssemblyFlavor(a)), [dispatch]);
  const changePairCharacters =
    useCallback((p: PairCharacters) => dispatch(config.changePairCharacters(p)), [dispatch]);
  const changeProcessAssembly =
    useCallback((p: ProcessAssembly) => dispatch(config.changeProcessAssembly(p)), [dispatch]);
  const changeDemangleAssembly =
    useCallback((d: DemangleAssembly) => dispatch(config.changeDemangleAssembly(d)), [dispatch]);
  const changeCargoScript =
    useCallback((c: CargoScript) => dispatch(config.changeCargoScript(c)), [dispatch]);

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

      {isNightly && (
        <MenuGroup title="Cargo">
          <EitherConfig
            id="cargo-script"
            name="Cargo Script"
            a={CargoScript.Enabled}
            b={CargoScript.Disabled}
            value={cargoScript}
            onChange={changeCargoScript}
          />

        </MenuGroup>
      )}
    </Fragment>
  );
};

export default ConfigMenu;
