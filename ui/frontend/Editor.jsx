import React, { PropTypes } from 'react';
import AceEditor from 'react-ace';
import brace from 'brace';

import 'brace/mode/rust';
import 'brace/theme/github';
import 'brace/keybinding/emacs';
// https://github.com/securingsincity/react-ace/issues/95
import 'brace/ext/language_tools';

export default class Editor extends React.Component {
  render() {
    const { code, onEditCode } = this.props;

    return (
      <div className="editor">
        <AceEditor
           mode="rust"
           theme="github"
           keyboardHandler="emacs"
           value={ code }
           onChange={ onEditCode }
           name="editor"
           width="auto"
           editorProps={ { $blockScrolling: true } } />
      </div>
    );
  }
};

Editor.propTypes = {
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired
};
