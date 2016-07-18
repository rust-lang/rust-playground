import React, { PropTypes } from 'react';
import AceEditor from 'react-ace';
import brace from 'brace';

import 'brace/mode/rust';
import 'brace/theme/github';
import 'brace/keybinding/emacs';
// https://github.com/securingsincity/react-ace/issues/95
import 'brace/ext/language_tools';

function SimpleEditor(props) {
  const { code, onEditCode } = props;

  return (
    <textarea className="editor-simple"
              name="editor-simple"
              value={ code }
              onChange={ e => onEditCode(e.target.value) } />
  );
}

function AdvancedEditor(props) {
  const { code, onEditCode } = props;

  return (
    <AceEditor
      mode="rust"
      theme="github"
      keyboardHandler="emacs"
      value={ code }
      onChange={ onEditCode }
      name="editor"
      width="100%"
      height="100%"
      editorProps={ { $blockScrolling: true } } />
  );
}

export default class Editor extends React.Component {
  render() {
    const { editor, code, onEditCode } = this.props;

    const simple = <SimpleEditor code={code} onEditCode={onEditCode} />;
    const advanced = <AdvancedEditor code={code} onEditCode={onEditCode} />;

    return (
      <div className="editor">
        { editor === "simple" ? simple : advanced }
      </div>
    );
  }
};

Editor.propTypes = {
  editor: PropTypes.string.isRequired,
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired
};
