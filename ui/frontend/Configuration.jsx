/* global ACE_KEYBINDINGS:false, ACE_THEMES:false */

import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';
import { connect } from 'react-redux';

import {
  changeEditor,
  changeKeybinding,
  changeTheme,
  toggleConfiguration,
} from './actions';

const keybindingOptions = ACE_KEYBINDINGS.map(t => <option value={t} key={t}>{t}</option>);
const themeOptions = ACE_THEMES.map(t => <option value={t} key={t}>{t}</option>);

class Configuration extends PureComponent {
  onChangeEditor = e => this.props.changeEditor(e.target.value);
  onChangeKeybinding = e => this.props.changeKeybinding(e.target.value);
  onChangeTheme = e => this.props.changeTheme(e.target.value);

  render() {
    const { editor, keybinding, theme, toggleConfiguration } = this.props;

    return (
      <div className="configuration">
        <div>
          <label htmlFor="config-editor">Editor Style</label>
          <select name="config-editor"
                  defaultValue={editor}
                  onChange={this.onChangeEditor}>
            <option value="simple">Simple</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <label htmlFor="config-keybinding">Editor Keybinding</label>
          <select name="config-keybinding"
                  defaultValue={keybinding}
                  onChange={this.onChangeKeybinding}>
            { keybindingOptions }
          </select>
        </div>

        <div>
          <label htmlFor="config-theme">Editor Theme</label>
          <select name="config-theme"
                  defaultValue={theme}
                  onChange={this.onChangeTheme}>
            { themeOptions }
          </select>
        </div>

        <div className="configuration-actions">
          <button onClick={toggleConfiguration}>Done</button>
        </div>
      </div>
    );
  }
}

Configuration.propTypes = {
  changeEditor: PropTypes.func.isRequired,
  changeKeybinding: PropTypes.func.isRequired,
  changeTheme: PropTypes.func.isRequired,
  editor: PropTypes.string.isRequired,
  keybinding: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  toggleConfiguration: PropTypes.func.isRequired,
};

const mapStateToProps = ({ configuration: { editor, keybinding, theme } }) => (
  { editor, keybinding, theme }
);

const mapDispatchToProps = dispatch => ({
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
