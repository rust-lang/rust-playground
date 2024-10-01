import * as monaco from 'monaco-editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAppSelector } from '../hooks';
import { CommonEditorProps } from '../types';
import { themeVsDarkPlus } from './rust_monaco_def';

import * as styles from './Editor.module.css';

function useEditorProp<T>(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  prop: T,
  whenPresent: (
    editor: monaco.editor.IStandaloneCodeEditor,
    model: monaco.editor.ITextModel,
    prop: T,
  ) => void,
) {
  useEffect(() => {
    if (!editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    whenPresent(editor, model, prop);
  }, [editor, prop, whenPresent]);
}

const MonacoEditorCore: React.FC<CommonEditorProps> = (props) => {
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const theme = useAppSelector((s) => s.configuration.monaco.theme);

  // Replace `initialCode` and `initialTheme` with an "effect event"
  // when those stabilize.
  //
  // https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event
  const initialCode = useRef(props.code);
  const initialTheme = useRef(theme);

  // One-time setup
  useEffect(() => {
    monaco.editor.defineTheme('vscode-dark-plus', themeVsDarkPlus);
  }, []);

  // Construct the editor
  const child = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }

    const editor = monaco.editor.create(node, {
      language: 'rust',
      value: initialCode.current,
      theme: initialTheme.current,
      automaticLayout: true,
      'semanticHighlighting.enabled': true,
    });
    setEditor(editor);

    editor.focus();
  }, []);

  useEditorProp(editor, props.onEditCode, (_editor, model, onEditCode) => {
    model.onDidChangeContent(() => {
      onEditCode(model.getValue());
    });
  });

  useEditorProp(editor, props.execute, (editor, _model, execute) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      execute();
    });
    // Ace's Vim mode runs code with :w, so let's do the same
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      execute();
    });
  });

  useEditorProp(editor, props.code, (editor, model, code) => {
    // Short-circuit if nothing interesting to change.
    if (code === model.getValue()) {
      return;
    }

    editor.executeEdits('redux', [
      {
        text: code,
        range: model.getFullModelRange(),
      },
    ]);
  });

  useEditorProp(editor, theme, (editor, _model, theme) => {
    editor.updateOptions({ theme });
  });

  return <div className={styles.monaco} ref={child} />;
};

export default MonacoEditorCore;
