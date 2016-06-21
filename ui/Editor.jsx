import React, { PropTypes } from 'react';
import AceEditor from 'react-ace';
import brace from 'brace';

import 'brace/mode/rust';
import 'brace/theme/github';
import 'brace/keybinding/emacs';

export default class Editor extends React.Component {
  render() {
    const { code, onEditCode } = this.props;

    return (
      <AceEditor
         mode="rust"
         theme="github"
         keyboardHandler="emacs"
         value={ code }
         onChange={ onEditCode }
         name="editor"
         editorProps={ { $blockScrolling: true } } />
    );
  }
};

Editor.propTypes = {
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired
};
