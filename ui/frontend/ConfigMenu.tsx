/* global ACE_KEYBINDINGS:false, ACE_THEMES:false */

import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import { Either as EitherConfig, Select as SelectConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';

import {
  changeAssemblyFlavor,
  changeDemangleAssembly,
  changeEditor,
  changeKeybinding,
  changeOrientation,
  changeProcessAssembly,
  changeTheme,
  toggleConfiguration,
} from './actions';
import State from './state';
import { AssemblyFlavor, DemangleAssembly, Editor, Orientation, ProcessAssembly } from './types';

interface ConfigMenuProps {
  assemblyFlavor: AssemblyFlavor;
  changeAssemblyFlavor: (_: AssemblyFlavor) => any;
  changeDemangleAssembly: (_: DemangleAssembly) => any;
  changeEditorStyle: (_: Editor) => any;
  changeKeybinding: (_: string) => any;
  changeOrientation: (_: Orientation) => any;
  changeProcessAssembly: (_: ProcessAssembly) => any;
  changeTheme: (_: string) => any;
  demangleAssembly: DemangleAssembly;
  editorStyle: Editor;
  keybinding: string;
  orientation: Orientation;
  processAssembly: ProcessAssembly;
  theme: string;
  close: () => void;
}

const ConfigMenu: React.SFC<ConfigMenuProps> = props => (
  <Fragment>
    <MenuGroup title="Editor">
      <EitherConfig
        id="editor-style"
        name="Style"
        a={Editor.Simple}
        b={Editor.Advanced}
        value={props.editorStyle}
        onChange={props.changeEditorStyle} />

      {props.editorStyle === Editor.Advanced && (
        <Fragment>
          <SelectConfig
            name="Keybinding"
            value={props.keybinding}
            onChange={props.changeKeybinding}
          >
            {ACE_KEYBINDINGS.map(k => <option key={k} value={k}>{k}</option>)}
          </SelectConfig>

          <SelectConfig
            name="Theme"
            value={props.theme}
            onChange={props.changeTheme}
          >
            {ACE_THEMES.map(t => <option key={t} value={t}>{t}</option>)}
          </SelectConfig>
        </Fragment>
      )}
    </MenuGroup>

    <MenuGroup title="UI">
      <SelectConfig
        name="Orientation"
        value={props.orientation}
        onChange={props.changeOrientation}
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
        value={props.assemblyFlavor}
        onChange={props.changeAssemblyFlavor} />

      <EitherConfig
        id="assembly-symbols"
        name="Symbol Demangling"
        a={DemangleAssembly.Demangle}
        b={DemangleAssembly.Mangle}
        aLabel="On"
        bLabel="Off"
        value={props.demangleAssembly}
        onChange={props.changeDemangleAssembly}
      />

      <EitherConfig
        id="assembly-view"
        name="Name Filtering"
        a={ProcessAssembly.Filter}
        b={ProcessAssembly.Raw}
        aLabel="On"
        bLabel="Off"
        value={props.processAssembly}
        onChange={props.changeProcessAssembly}
      />
    </MenuGroup>
  </Fragment>
);

const mapStateToProps = (state: State) => ({
  keybinding: state.configuration.keybinding,
  theme: state.configuration.theme,
  orientation: state.configuration.orientation,
  editorStyle: state.configuration.editor,
  assemblyFlavor: state.configuration.assemblyFlavor,
  demangleAssembly: state.configuration.demangleAssembly,
  processAssembly: state.configuration.processAssembly,
});

const mapDispatchToProps = ({
  changeTheme,
  changeKeybinding,
  changeOrientation,
  changeEditorStyle: changeEditor,
  changeAssemblyFlavor,
  changeProcessAssembly,
  changeDemangleAssembly,
});

export default connect(mapStateToProps, mapDispatchToProps)(ConfigMenu);
