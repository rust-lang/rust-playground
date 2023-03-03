import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as actions from '../actions';
import { useAppDispatch } from '../configureStore';

import AceEditor from './AceEditor';
import SimpleEditor from './SimpleEditor';
import MonacoEditor from './MonacoEditor';
import { Editor as EditorType } from '../types';
import { codeSelector, positionSelector, selectionSelector } from '../selectors';
import { State } from '../reducers';

import styles from './Editor.module.css';

const editorMap = {
  [EditorType.Simple]: SimpleEditor,
  [EditorType.Ace]: AceEditor,
  [EditorType.Monaco]: MonacoEditor,
};

const Editor: React.FC = () => {
  const code = useSelector(codeSelector);
  const editor = useSelector((state: State) => state.configuration.editor);
  const position = useSelector(positionSelector);
  const selection = useSelector(selectionSelector);
  const crates = useSelector((state: State) => state.crates);

  const dispatch = useAppDispatch();
  const execute = useCallback(() => dispatch(actions.performPrimaryAction()), [dispatch]);
  const onEditCode = useCallback((c: string) => dispatch(actions.editCode(c)), [dispatch]);

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
