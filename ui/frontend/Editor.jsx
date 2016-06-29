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
    const { editor } = this.props;

    return (
      <div className="editor">
        { editor === "simple" ? this.simpleEditor() : this.advancedEditor() }
      </div>
    );
  }

  simpleEditor() {
    const { code, onEditCode } = this.props;

    return (
      <textarea className="editor-simple"
                name="editor-simple"
                value={ code }
                onChange={ e => onEditCode(e.target.value) } />
    );
  }

  advancedEditor() {
    const { code, onEditCode } = this.props;

    return (
      <AceEditor
         mode="rust"
         theme="github"
         keyboardHandler="emacs"
         value={ code }
         onChange={ onEditCode }
         name="editor"
         width="auto"
         editorProps={ { $blockScrolling: true } } />
    );
  }
};

Editor.propTypes = {
  editor: PropTypes.string.isRequired,
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired
};
