import React from 'react';
import { CommonEditorProps } from '../types';
import MonacoEditor, { EditorWillMount } from 'react-monaco-editor';
import { useSelector } from 'react-redux';
import State from '../state';
import { config, grammar, themeVsDarkPlus } from './rust_monaco_def';

import styles from './Editor.module.css';

const MODE_ID = 'my-rust';

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

const MonacoEditorCore: React.SFC<CommonEditorProps> = props => {
  const theme = useSelector((s: State) => s.configuration.monaco.theme);

  return (
    <MonacoEditor
      language={MODE_ID}
      theme={theme}
      className={styles.monaco}
      value={props.code}
      onChange={props.onEditCode}
      editorWillMount={initMonaco}
      options={{ automaticLayout: true }}
    />
  );
}

export default MonacoEditorCore;
