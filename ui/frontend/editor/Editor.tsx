import React from 'react';

import * as actions from '../actions';
import { useAppDispatch, useAppSelector } from '../hooks';
import { editCode } from '../reducers/code';
import * as config from '../reducers/configuration';
import * as files from '../reducers/files';
import { activeCodeSelector, positionSelector, selectionSelector } from '../selectors';
import { activeFileIdSelector, fileIdsSelector } from '../selectors';
import { Editor as EditorType } from '../types';
import AceEditor from './AceEditor';
import MonacoEditor from './MonacoEditor';
import SimpleEditor from './SimpleEditor';

import * as styles from './Editor.module.css';

interface NothingActionProps {
  onClick: () => void;
  children: React.ReactNode;
}

const NothingAction: React.FC<NothingActionProps> = ({ onClick, children }) => (
  <button className={styles.nothingAction} type="button" onClick={onClick}>
    {children}
  </button>
);

const NothingToEdit: React.FC = () => {
  'use memo';

  const dispatch = useAppDispatch();

  return (
    <div className={styles.nothing}>
      <p>
        No files exist. Create a{' '}
        <NothingAction onClick={() => dispatch(files.createFile('src/main.rs'))}>
          new file
        </NothingAction>{' '}
        or{' '}
        <NothingAction onClick={() => dispatch(config.changeFileView('single'))}>
          switch back to single file mode
        </NothingAction>
        .
      </p>
    </div>
  );
};

const editorMap = {
  [EditorType.Simple]: SimpleEditor,
  [EditorType.Ace]: AceEditor,
  [EditorType.Monaco]: MonacoEditor,
};

const Editor: React.FC = () => {
  'use memo';

  const code = useAppSelector(activeCodeSelector);
  const editor = useAppSelector((state) => state.configuration.editor);
  const position = useAppSelector(positionSelector);
  const selection = useAppSelector(selectionSelector);
  const crates = useAppSelector((state) => state.crates);
  const activeFileId = useAppSelector(activeFileIdSelector);
  const fileIds = useAppSelector(fileIdsSelector);

  const dispatch = useAppDispatch();

  if (code === undefined || activeFileId === null) {
    return <NothingToEdit />;
  }

  const SelectedEditor = editorMap[editor];

  return (
    <div className={styles.container}>
      <SelectedEditor
        code={code}
        position={position}
        selection={selection}
        crates={crates}
        activeFileId={activeFileId}
        fileIds={fileIds}
        onEditCode={(c) => dispatch(editCode(c))}
        execute={() => dispatch(actions.performPrimaryAction())}
      />
    </div>
  );
};

export default Editor;
