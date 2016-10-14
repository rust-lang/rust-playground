import ace from 'brace';

import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';
import AceEditor from 'react-ace';
import { connect } from 'react-redux';

import 'brace/mode/rust';

import { editCode, performExecute } from './actions';

class SimpleEditor extends PureComponent {
  onChange = e => this.props.onEditCode(e.target.value);
  trackEditor = component => this._editor = component;
  onKeyDown = e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      this.props.execute();
    }
  }

  render() {
    return (
      <textarea
         ref={ this.trackEditor }
         className="editor-simple"
         name="editor-simple"
         value={ this.props.code }
         onChange={ this.onChange }
         onKeyDown= { this.onKeyDown } />
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
    const { keybinding, theme, code, onEditCode } = this.props;

    const realKeybinding = keybinding === 'ace' ? null : keybinding;

    // These are part of the vendor chunk
    if (realKeybinding) {
      require(`brace/keybinding/${realKeybinding}`);

      if (realKeybinding === 'vim') {
        const { CodeMirror: { Vim } } = ace.acequire('ace/keyboard/vim');
        Vim.defineEx("write", "w", (cm, _input) => {
          cm.ace.execCommand("executeCode");
        });
      }
    }

    require(`brace/theme/${theme}`);

    return (
      <AceEditor
         ref={ this.trackEditor }
         mode="rust"
         keyboardHandler={realKeybinding}
         theme={theme}
         value={ code }
         onChange={ onEditCode }
         name="editor"
         width="100%"
         height="100%"
         editorProps={ { $blockScrolling: true } } />
    );
  }

  componentDidMount() {
    this._editor.editor.commands.addCommand({
      name: 'executeCode',
      bindKey: {
        win: 'Ctrl-Enter',
        mac: 'Ctrl-Enter|Command-Enter',
      },
      exec: this.props.execute,
      readOnly: true
    });
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
    const { editor, execute, keybinding, theme, code, position, onEditCode } = this.props;
    const SelectedEditor = editor === "simple" ? SimpleEditor : AdvancedEditor;

    return (
      <div className="editor">
        <SelectedEditor keybinding={keybinding}
                        theme={theme}
                        code={code}
                        position={position}
                        onEditCode={onEditCode}
                        execute={execute} />;
      </div>
    );
  }
}

Editor.propTypes = {
  code: PropTypes.string.isRequired,
  editor: PropTypes.string.isRequired,
  execute: PropTypes.func.isRequired,
  keybinding: PropTypes.string.isRequired,
  onEditCode: PropTypes.func.isRequired,
  position: PropTypes.shape({
    line: PropTypes.number.isRequired,
    column: PropTypes.number.isRequired,
  }).isRequired,
  theme: PropTypes.string.isRequired,
};

const mapStateToProps = ({ code, configuration: { editor, keybinding, theme }, position }) => (
  { code, editor, keybinding, theme, position }
);

const mapDispatchToProps = dispatch => ({
  execute: () => dispatch(performExecute()),
  onEditCode: code => dispatch(editCode(code)),
});

const ConnectedEditor = connect(
  mapStateToProps,
  mapDispatchToProps
)(Editor);

export default ConnectedEditor;
