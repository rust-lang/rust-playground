import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';
import AceEditor from 'react-ace';
import { connect } from 'react-redux';

import 'brace/mode/rust';
import 'brace/keybinding/emacs';

import { editCode } from './actions';

class SimpleEditor extends PureComponent {
  onChange = e => this.props.onEditCode(e.target.value);
  trackEditor = component => this._editor = component;

  render() {
    return (
      <textarea
         ref={ this.trackEditor }
         className="editor-simple"
         name="editor-simple"
         value={ this.props.code }
         onChange={ this.onChange } />
    );
  }

  componentDidUpdate(prevProps, _prevState) {
    this.gotoPosition(prevProps.position, this.props.position);
  }

  gotoPosition(oldPosition, newPosition) {
    const editor = this._editor;

    if (!newPosition || !editor) { return; }
    if (newPosition === oldPosition) { return; }

    // Subtract one as this logix is zero-based and the lines are one-based
    const line = newPosition.line - 1;
    const { code } = this.props;

    const lines = code.split('\n');

    const precedingLines = lines.slice(0, line);
    const highlightedLine = lines[line];

    // Add one to account for the newline we split on and removed
    const precedingBytes = precedingLines.map(l => l.length + 1).reduce((a, b) => a + b);
    const highlightedBytes = highlightedLine.length;

    editor.setSelectionRange(precedingBytes, precedingBytes + highlightedBytes);
  }
}

class AdvancedEditor extends PureComponent {
  trackEditor = component => this._editor = component;

  render() {
    const { theme, code, onEditCode } = this.props;

    // These are part of the vendor chunk
    require(`brace/theme/${theme}`);

    return (
      <AceEditor
         ref={ this.trackEditor }
         mode="rust"
         theme={theme}
         keyboardHandler="emacs"
         value={ code }
         onChange={ onEditCode }
         name="editor"
         width="100%"
         height="100%"
         editorProps={ { $blockScrolling: true } } />
    );
  }

  componentDidUpdate(prevProps, _prevState) {
    this.gotoPosition(prevProps.position, this.props.position);
  }

  gotoPosition(oldPosition, newPosition) {
    const editor = this._editor;

    if (!newPosition || !editor) { return; }
    if (newPosition === oldPosition) { return; }

    const { line, column } = newPosition;

    // Columns are zero-indexed in ACE
    editor.editor.gotoLine(line, column - 1);
    editor.editor.focus();
  }
}

class Editor extends PureComponent {
  render() {
    const { editor, theme, code, position, onEditCode } = this.props;
    const SelectedEditor = editor === "simple" ? SimpleEditor : AdvancedEditor;

    return (
      <div className="editor">
        <SelectedEditor theme={theme} code={code} position={position} onEditCode={onEditCode} />;
      </div>
    );
  }
}

Editor.propTypes = {
  code: PropTypes.string.isRequired,
  editor: PropTypes.string.isRequired,
  onEditCode: PropTypes.func.isRequired,
  position: PropTypes.shape({
    line: PropTypes.number.isRequired,
    column: PropTypes.number.isRequired,
  }).isRequired,
  theme: PropTypes.string.isRequired,
};

const mapStateToProps = ({ code, configuration: { editor, theme }, position }) => (
  { code, editor, theme, position }
);

const mapDispatchToProps = dispatch => ({
  onEditCode: code => dispatch(editCode(code)),
});

const ConnectedEditor = connect(
  mapStateToProps,
  mapDispatchToProps
)(Editor);

export default ConnectedEditor;
