import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as actions from '../actions';
import { useAppDispatch } from '../configureStore';

import AceEditor from './AceEditor';
import MonacoEditor from './MonacoEditor';
import { CommonEditorProps, Editor as EditorType, Position, Selection } from '../types';
import { State } from '../reducers';

import styles from './Editor.module.css';

class CodeByteOffsets {
  readonly code: string;
  readonly lines: string[];

  constructor(code: string) {
    this.code = code;
    this.lines = code.split('\n');
  }

  public lineToOffsets(line: number) {
    const precedingBytes = this.bytesBeforeLine(line);

    const highlightedLine = this.lines[line];
    const highlightedBytes = highlightedLine.length;

    return [precedingBytes, precedingBytes + highlightedBytes];
  }

  public rangeToOffsets(start: Position, end: Position) {
    const startBytes = this.positionToBytes(start);
    const endBytes = this.positionToBytes(end);
    return [startBytes, endBytes];
  }

  private positionToBytes(position: Position) {
    // Subtract one as this logic is zero-based and the columns are one-based
    return this.bytesBeforeLine(position.line) + position.column - 1;
  }

  private bytesBeforeLine(line: number) {
    // Subtract one as this logic is zero-based and the lines are one-based
    line -= 1;

    const precedingLines = this.lines.slice(0, line);

    // Add one to account for the newline we split on and removed
    return precedingLines.map(l => l.length + 1).reduce((a, b) => a + b);
  }
}

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
        className={styles.simple}
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
    this.setSelection(prevProps.selection, this.props.selection);
  }

  private gotoPosition(oldPosition: Position, newPosition: Position) {
    const editor = this._editor;

    if (!newPosition || !editor) { return; }
    if (newPosition === oldPosition) { return; }

    const offsets = new CodeByteOffsets(this.props.code);
    const [startBytes, endBytes] = offsets.lineToOffsets(newPosition.line);

    editor.focus();
    editor.setSelectionRange(startBytes, endBytes);
  }

  private setSelection(oldSelection: Selection, newSelection: Selection) {
    const editor = this._editor;

    if (!newSelection || !editor) { return; }
    if (newSelection === oldSelection) { return; }

    const offsets = new CodeByteOffsets(this.props.code);
    const [startBytes, endBytes] = offsets.rangeToOffsets(newSelection.start, newSelection.end);

    editor.focus();
    editor.setSelectionRange(startBytes, endBytes);
  }
}

const editorMap = {
  [EditorType.Simple]: SimpleEditor,
  [EditorType.Ace]: AceEditor,
  [EditorType.Monaco]: MonacoEditor,
};

const Editor: React.SFC = () => {
  const code = useSelector((state: State) => state.code);
  const editor = useSelector((state: State) => state.configuration.editor);
  const position = useSelector((state: State) => state.position);
  const selection = useSelector((state: State) => state.selection);
  const crates = useSelector((state: State) => state.crates);

  const dispatch = useAppDispatch();
  const execute = useCallback(() => dispatch(actions.performPrimaryAction()), [dispatch]);
  const onEditCode = useCallback((c) => dispatch(actions.editCode(c)), [dispatch]);

  const SelectedEditor = editorMap[editor];

  return (
    <div className={styles.container}>
      <SelectedEditor code={code}
        position={position}
        selection={selection}
        crates={crates}
        onEditCode={onEditCode}
        execute={execute} />
    </div>
  );
};

export default Editor;
