import React from 'react';
import { connect } from 'react-redux';

import { editCode, performPrimaryAction } from './actions';
import AdvancedEditor from './AdvancedEditor';
import { CommonEditorProps, Editor as EditorType } from './types';

class SimpleEditor extends React.PureComponent<CommonEditorProps> {
  private _editor: HTMLTextAreaElement;

  private onChange = e => this.props.onEditCode(e.target.value);
  private trackEditor = component => this._editor = component;
  private onKeyDown = e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      this.props.execute();
    }
  }

  public render() {
    return (
      <textarea
        ref={this.trackEditor}
        className="editor-simple"
        name="editor-simple"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={this.props.code}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown} />
    );
  }

  public componentDidUpdate(prevProps, _prevState) {
    this.gotoPosition(prevProps.position, this.props.position);
  }

  private gotoPosition(oldPosition, newPosition) {
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

class Editor extends React.PureComponent<EditorProps> {
  public render() {
    const { editor, execute, code, crates, position, onEditCode } = this.props;
    const SelectedEditor = editor === EditorType.Simple ? SimpleEditor : AdvancedEditor;

    return (
      <div className="editor">
        <SelectedEditor code={code}
          position={position}
          crates={crates}
          onEditCode={onEditCode}
          execute={execute} />
      </div>
    );
  }
}

interface EditorProps {
  code: string;
  editor: EditorType;
  execute: () => any;
  onEditCode: (_: string) => any;
  position: {
    line: number;
    column: number;
  };
  crates: {
    id: string;
    name: string;
    version: string;
  }[];
}

const mapStateToProps = ({ code, configuration: { editor }, position, crates }) => (
  { code, editor, position, crates }
);

const mapDispatchToProps = ({
  execute: performPrimaryAction,
  onEditCode: editCode,
});

const ConnectedEditor = connect(
  mapStateToProps,
  mapDispatchToProps,
)(Editor);

export default ConnectedEditor;
