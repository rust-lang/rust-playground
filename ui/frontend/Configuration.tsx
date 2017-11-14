/* global ACE_KEYBINDINGS:false, ACE_THEMES:false */

import React from 'react';
import { connect } from 'react-redux';

import {
  changeAssemblyFlavor,
  changeDemangleAssembly,
  changeEditor,
  changeHideAssemblerDirectives,
  changeKeybinding,
  changeOrientation,
  changeTheme,
  toggleConfiguration,
} from './actions';
import State from './state';
import { AssemblyFlavor, DemangleAssembly, Editor, HideAssemblerDirectives, Orientation } from './types';

const keybindingOptions = ACE_KEYBINDINGS.map(t => <option value={t} key={t}>{t}</option>);
const themeOptions = ACE_THEMES.map(t => <option value={t} key={t}>{t}</option>);

const ConfigurationSelect: React.SFC<ConfigurationSelectProps> = ({
    what, label, defaultValue, onChange, children,
}) => (
  <div className="configuration-item">
    <label htmlFor={`config-${what}`}
           className="configuration-label">
      {label}
    </label>
    <select name={`config-${what}`}
            className="configuration-value"
            defaultValue={defaultValue}
            onChange={onChange}>
      {children}
    </select>
  </div>
);

interface ConfigurationSelectProps {
  what: string;
  label: string;
  defaultValue: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}

const ESCAPE_KEYCODE = 27;

class Configuration extends React.PureComponent<ConfigurationProps> {
  private onChangeEditor = e => this.props.changeEditor(e.target.value);
  private onChangeKeybinding = e => this.props.changeKeybinding(e.target.value);
  private onChangeTheme = e => this.props.changeTheme(e.target.value);
  private onChangeOrientation = e => this.props.changeOrientation(e.target.value);
  private onChangeAssemblyFlavor = e => this.props.changeAssemblyFlavor(e.target.value);
  private onChangeDemangleAssembly = e => this.props.changeDemangleAssembly(e.target.value);
  private onChangeHideAssemblerDirectives = e => this.props.changeHideAssemblerDirectives(e.target.value);
  private onKeyup = e => {
    if (e.keyCode === ESCAPE_KEYCODE && !e.defaultPrevented) {
      e.preventDefault();
      this.props.toggleConfiguration();
    }
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyup);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyup);
  }

  public render() {
    const { editor, keybinding, theme, orientation, assemblyFlavor, demangleAssembly, hideAssemblerDirectives, toggleConfiguration } = this.props;

    const advancedEditor = editor === Editor.Advanced;

    const keybindingSelect = advancedEditor ? (
      <ConfigurationSelect what="keybinding"
                           label="Editor Keybinding"
                           defaultValue={keybinding}
                           onChange={this.onChangeKeybinding}>
        {keybindingOptions}
      </ConfigurationSelect>
    ) : null;

    const themeSelect = advancedEditor ? (
      <ConfigurationSelect what="theme"
                           label="Editor Theme"
                           defaultValue={theme}
                           onChange={this.onChangeTheme}>
        {themeOptions}
      </ConfigurationSelect>
    ) : null;

    return (
      <div className="configuration">
        <ConfigurationSelect what="editor"
                             label="Editor Style"
                             defaultValue={editor}
                             onChange={this.onChangeEditor}>
          <option value={Editor.Simple}>Simple</option>
          <option value={Editor.Advanced}>Advanced</option>
        </ConfigurationSelect>

        {keybindingSelect}

        {themeSelect}

        <ConfigurationSelect what="orientation"
                             label="Split Orientation"
                             defaultValue={orientation}
                             onChange={this.onChangeOrientation}>
          <option value={Orientation.Automatic}>Automatic</option>
          <option value={Orientation.Horizontal}>Horizontal</option>
          <option value={Orientation.Vertical}>Vertical</option>
        </ConfigurationSelect>

        <ConfigurationSelect what="assemblyFlavor"
                             label="Assembly Flavor"
                             defaultValue={assemblyFlavor}
                             onChange={this.onChangeAssemblyFlavor}>
          <option value={AssemblyFlavor.Att}>AT&T</option>
          <option value={AssemblyFlavor.Intel}>Intel</option>
        </ConfigurationSelect>

        <ConfigurationSelect what="demangleAssembly"
                             label="Demangle Symbols"
                             defaultValue={demangleAssembly}
                             onChange={this.onChangeDemangleAssembly}>
          <option value={DemangleAssembly.Demangle}>Demangled</option>
          <option value={DemangleAssembly.Mangle}>Mangled</option>
        </ConfigurationSelect>

        <ConfigurationSelect what="hideAssemblerDirectives"
                             label="Assembler Directives"
                             defaultValue={hideAssemblerDirectives}
                             onChange={this.onChangeHideAssemblerDirectives}>
          <option value={HideAssemblerDirectives.Hide}>Remove</option>
          <option value={HideAssemblerDirectives.Show}>Display</option>
        </ConfigurationSelect>

        <div className="configuration-actions">
          <button onClick={toggleConfiguration}>Done</button>
        </div>
      </div>
    );
  }
}

interface ConfigurationProps {
  changeEditor: (Editor) => any;
  changeKeybinding: (_: string) => any;
  changeTheme: (_: string) => any;
  changeOrientation: (Orientation) => any;
  changeAssemblyFlavor: (AssemblyFlavor) => any;
  changeDemangleAssembly: (DemangleAssembly) => any;
  changeHideAssemblerDirectives: (HideAssemblerDirectives) => any;
  editor: Editor;
  keybinding: string;
  theme: string;
  orientation: Orientation;
  assemblyFlavor: AssemblyFlavor;
  demangleAssembly: DemangleAssembly;
  hideAssemblerDirectives: HideAssemblerDirectives;
  toggleConfiguration: () => any;
}

const mapStateToProps = ({ configuration: { editor, keybinding, theme, orientation, assemblyFlavor, demangleAssembly, hideAssemblerDirectives } }: State) => (
  { editor, keybinding, theme, orientation, assemblyFlavor, demangleAssembly, hideAssemblerDirectives }
);

const mapDispatchToProps = ({
  changeEditor,
  changeKeybinding,
  changeTheme,
  changeOrientation,
  changeAssemblyFlavor,
  changeDemangleAssembly,
  changeHideAssemblerDirectives,
  toggleConfiguration,
});

const ConnectedConfiguration = connect(
  mapStateToProps,
  mapDispatchToProps,
)(Configuration);

export default ConnectedConfiguration;
