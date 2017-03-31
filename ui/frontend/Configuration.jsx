/* global ACE_KEYBINDINGS:false, ACE_THEMES:false */

import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';
import { connect } from 'react-redux';

import {
  changeHemisphere,
  changeEditor,
  changeKeybinding,
  changeTheme,
  toggleConfiguration,
} from './actions';

const keybindingOptions = ACE_KEYBINDINGS.map(t => <option value={t} key={t}>{t}</option>);
const themeOptions = ACE_THEMES.map(t => <option value={t} key={t}>{t}</option>);

const ConfigurationSelect = ({ what, label, defaultValue, onChange, children }) => (
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

ConfigurationSelect.propTypes = {
  what: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  defaultValue: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

const ESCAPE_KEYCODE = 27;

class Configuration extends PureComponent {
  onChangeHemisphere = e => this.props.changeHemisphere(e.target.value);
  onChangeEditor = e => this.props.changeEditor(e.target.value);
  onChangeKeybinding = e => this.props.changeKeybinding(e.target.value);
  onChangeTheme = e => this.props.changeTheme(e.target.value);
  onKeyup = e => {
    if (e.keyCode === ESCAPE_KEYCODE && !e.defaultPrevented) {
      e.preventDefault();
      this.props.toggleConfiguration();
    }
  }

  componentDidMount() {
    window.addEventListener('keyup', this.onKeyup);
  }

  componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyup);
  }

  render() {
    const { hemisphere, hemisphereEnabled, editor, keybinding, theme, toggleConfiguration } = this.props;

    const advancedEditor = editor === 'advanced';

    const keybindingSelect = advancedEditor ? (
      <ConfigurationSelect what="keybinding"
                           label="Editor Keybinding"
                           defaultValue={keybinding}
                           onChange={this.onChangeKeybinding}>
        { keybindingOptions }
      </ConfigurationSelect>
    ) : null;

    const themeSelect = advancedEditor ? (
      <ConfigurationSelect what="theme"
                           label="Editor Theme"
                           defaultValue={theme}
                           onChange={this.onChangeTheme}>
        { themeOptions }
      </ConfigurationSelect>
    ) : null;

    return (
      <div className="configuration">
        <ConfigurationSelect what="editor"
                             label="Editor Style"
                             defaultValue={editor}
                             onChange={this.onChangeEditor}>
          <option value="simple">Simple</option>
          <option value="advanced">Advanced</option>
        </ConfigurationSelect>

        {keybindingSelect}

        {themeSelect}

        { hemisphereEnabled ?
        <ConfigurationSelect what="hemisphere"
                             label="Hemisphere"
                             defaultValue={hemisphere}
                             onChange={this.onChangeHemisphere}>
          <option value="northern">Northern</option>
          <option value="southern">Southern</option>
          <option value="no-fun">The No-Fun Zone</option>
        </ConfigurationSelect>
        : null }

        <div className="configuration-actions">
          <button onClick={toggleConfiguration}>Done</button>
        </div>
      </div>
    );
  }
}

Configuration.propTypes = {
  changeEditor: PropTypes.func.isRequired,
  changeHemisphere: PropTypes.func.isRequired,
  changeKeybinding: PropTypes.func.isRequired,
  changeTheme: PropTypes.func.isRequired,
  hemisphere: PropTypes.string.isRequired,
  hemisphereEnabled: PropTypes.bool.isRequired,
  editor: PropTypes.string.isRequired,
  keybinding: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  toggleConfiguration: PropTypes.func.isRequired,
};

const mapStateToProps = ({ configuration: { hemisphere, hemisphereEnabled, editor, keybinding, theme } }) => (
  { hemisphere, hemisphereEnabled, editor, keybinding, theme }
);

const mapDispatchToProps = dispatch => ({
  changeHemisphere: hemisphere => dispatch(changeHemisphere(hemisphere)),
  changeEditor: editor => dispatch(changeEditor(editor)),
  changeKeybinding: keybinding => dispatch(changeKeybinding(keybinding)),
  changeTheme: theme => dispatch(changeTheme(theme)),
  toggleConfiguration: () => dispatch(toggleConfiguration()),
});

const ConnectedConfiguration = connect(
  mapStateToProps,
  mapDispatchToProps
)(Configuration);

export default ConnectedConfiguration;
