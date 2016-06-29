import React, { PropTypes } from 'react';

export default class Configuration extends React.Component {
  render() {
    const { editor, changeEditor, toggleConfiguration } = this.props;

    return (
      <div className="configuration">
        <label htmlFor="config-editor">Editor Style</label>
        <select name="config-editor"
                defaultValue={editor}
                onChange={e => changeEditor(e.target.value)}>
          <option value="simple">Simple</option>
          <option value="advanced">Advanced</option>
        </select>

        <div className="configuration-actions">
          <button onClick={toggleConfiguration}>Done</button>
        </div>
      </div>
    );
  }
};

Configuration.propTypes = {
  editor: PropTypes.string.isRequired,
  changeEditor: PropTypes.func.isRequired,
  toggleConfiguration: PropTypes.func.isRequired
};
