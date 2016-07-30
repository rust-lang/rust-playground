/* global ACE_THEMES:false */

import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';

const themeOptions = ACE_THEMES.map(t => <option value={t} key={t}>{t}</option>);

export default class Configuration extends PureComponent {
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
  editor: PropTypes.string.isRequired,
  changeEditor: PropTypes.func.isRequired,
  theme: PropTypes.string.isRequired,
  changeTheme: PropTypes.func.isRequired,
  toggleConfiguration: PropTypes.func.isRequired
};
