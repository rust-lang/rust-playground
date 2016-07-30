/* global ACE_THEMES:false */

import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';
import { connect } from 'react-redux';

import {
  changeEditor,
  changeTheme,
  toggleConfiguration,
} from './actions';

const themeOptions = ACE_THEMES.map(t => <option value={t} key={t}>{t}</option>);

class Configuration extends PureComponent {
  onChangeEditor = e => this.props.changeEditor(e.target.value);
  onChangeTheme = e => this.props.changeTheme(e.target.value);

  render() {
    const { editor, theme, toggleConfiguration } = this.props;

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
  changeTheme: PropTypes.func.isRequired,
  editor: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  toggleConfiguration: PropTypes.func.isRequired,
};

const mapStateToProps = ({ configuration: { editor, theme } }) => (
  { editor, theme }
);

const mapDispatchToProps = dispatch => ({
  changeEditor: editor => dispatch(changeEditor(editor)),
  changeTheme: theme => dispatch(changeTheme(theme)),
  toggleConfiguration: () => dispatch(toggleConfiguration()),
});

const ConnectedConfiguration = connect(
  mapStateToProps,
  mapDispatchToProps
)(Configuration);

export default ConnectedConfiguration;
