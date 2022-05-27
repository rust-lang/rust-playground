import React from 'react';
import { CommonEditorProps } from '../types';
import MonacoEditor, { EditorDidMount, EditorWillMount } from 'react-monaco-editor';
import { useSelector } from 'react-redux';
import State from '../state';
import { config, grammar, themeVsDarkPlus } from './rust_monaco_def';

import styles from './Editor.module.css';

const MODE_ID = 'rust';

const initMonaco: EditorWillMount = (monaco) => {
  monaco.editor.defineTheme('vscode-dark-plus', themeVsDarkPlus);
  monaco.languages.register({
    id: MODE_ID,
  });

  monaco.languages.onLanguage(MODE_ID, async () => {
    monaco.languages.setLanguageConfiguration(MODE_ID, config);
    monaco.languages.setMonarchTokensProvider(MODE_ID, grammar);
  });
};

const initEditor = (execute: () => any): EditorDidMount => (editor, monaco) => {
  editor.focus();
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    execute();
  });
  // Ace's Vim mode runs code with :w, so let's do the same
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    execute();
  });
};

const MonacoEditorCore: React.FC<CommonEditorProps> = props => {
  const theme = useSelector((s: State) => s.configuration.monaco.theme);

  return (
    <MonacoEditor
      language={MODE_ID}
      theme={theme}
      className={styles.monaco}
      value={props.code}
      onChange={props.onEditCode}
      editorWillMount={initMonaco}
      editorDidMount={initEditor(props.execute)}
      options={{
        automaticLayout: true,
        'semanticHighlighting.enabled': true,
      }}
    />
  );
}

export default MonacoEditorCore;
