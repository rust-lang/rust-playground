import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import React, { useEffect, useEffectEvent, useRef, useState } from 'react';

import * as Icons from './Icon';
import * as filesRules from './domain/filesRules';
import {
  DirInError,
  FilePathInError,
  defaultSelection,
  validateDirRename,
  validateFilename,
} from './domain/filesRules';
import { useAppDispatch, useAppSelector } from './hooks';
import * as filesActions from './reducers/files';
import * as files from './selectors/files';

import * as styles from './FileTree.module.css';

const describeError = (err: FilePathInError | DirInError): React.ReactNode => {
  switch (err.kind) {
    case 'dir-duplicate':
      return (
        <>
          The file <code>{err.value}</code> already exists
        </>
      );
    case 'dir-leading-slash':
      return 'May not start with a leading slash';
    case 'dir-empty-component':
      return 'May not have directories with no name';
    case 'file-cargo-toml':
      return (
        <>
          May not create a <code>Cargo.toml</code> at the top level
        </>
      );
    case 'file-playground-toml':
      return (
        <>
          May not create a <code>Playground.toml</code> at the top level
        </>
      );
    case 'file-dir-conflict':
      return 'May not create a file and directory of the same name';
    case 'file-dotfile':
      return 'May not create path components starting with a dot';
    case 'file-duplicate':
      return (
        <>
          The file <code>{err.value}</code> already exists
        </>
      );
    case 'file-empty-name':
      return 'May not have files with no name';
    default: {
      const _exhaustive: never = err;
    }
  }
};

interface NameInputLabels {
  accept: string;
  cancel: string;
}

interface NameInputProps<E> {
  Icon?: React.ComponentType;
  labels: NameInputLabels;
  defaultValue: string;
  originalValue?: string;
  validate: (n: string) => E | null;
  describeError: (e: E) => React.ReactNode;
  onAccept: (n: string) => void;
  onCancel: () => void;
}

const NameInput = <E,>({
  Icon,
  labels,
  defaultValue,
  originalValue,
  validate,
  describeError,
  onAccept: onCallerAccept,
  onCancel,
}: NameInputProps<E>) => {
  'use memo';

  const [errorKind, setErrorKind] = useState<E | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const keydown = (evt: React.KeyboardEvent) => {
    if (evt.key === 'Escape') {
      onCancel();
    }
  };

  const submit = (evt: React.SubmitEvent) => {
    evt.preventDefault();
    setErrorKind(null);

    const newName = inputRef.current?.value;
    if (!newName || originalValue === newName) {
      onCancel();
      return;
    }

    const errorKind = validate(newName);
    if (errorKind) {
      setErrorKind(errorKind);
      return;
    }

    onCancel();
    onCallerAccept(newName);
  };

  const setSelection = (node: HTMLInputElement) => {
    inputRef.current = node;
    const [s, e] = defaultSelection(defaultValue);
    node.setSelectionRange(s, e);
    return () => {
      inputRef.current = null;
    };
  };

  return (
    <form className={styles.nameInputForm} onSubmit={submit}>
      {Icon && <Icon />}
      <input
        className={styles.nameInputInput}
        name="pathname"
        autoFocus
        onKeyDown={keydown}
        defaultValue={defaultValue}
        ref={setSelection}
      />
      <button className={styles.iconButton} type="submit" data-kind="accept" title={labels.accept}>
        <Icons.CheckCircle />
      </button>
      <button
        className={styles.iconButton}
        type="button"
        data-kind="cancel"
        onClick={onCancel}
        title={labels.cancel}
      >
        <Icons.Cancel />
      </button>
      {errorKind && <span className={styles.nameInputError}>{describeError(errorKind)}</span>}
    </form>
  );
};

const NAME_INPUT_LABELS = {
  create: { accept: 'Create new file', cancel: 'Cancel file creation' },
  rename: { accept: 'Rename file', cancel: 'Cancel file rename' },
};

interface SpecificInputProps {
  Icon?: React.ComponentType;
  defaultValue: string;
  originalValue?: string;
  onAccept: (n: string) => void;
  onCancel: () => void;
}

const FilenameInput: React.FC<SpecificInputProps & { kind: keyof typeof NAME_INPUT_LABELS }> = ({
  Icon,
  kind,
  defaultValue,
  originalValue,
  onAccept,
  onCancel,
}) => {
  'use memo';

  const filenames = useAppSelector(files.filenamesSelector);
  const validate = (name: string) => validateFilename(filenames, name);
  const labels = NAME_INPUT_LABELS[kind];

  return (
    <NameInput
      Icon={Icon}
      labels={labels}
      defaultValue={defaultValue}
      originalValue={originalValue}
      validate={validate}
      describeError={describeError}
      onAccept={onAccept}
      onCancel={onCancel}
    />
  );
};

const DIRNAME_INPUT_LABELS = {
  accept: 'Rename directory',
  cancel: 'Cancel directory rename',
};

const DirnameInput: React.FC<SpecificInputProps & { originalValue: string }> = ({
  Icon,
  defaultValue,
  originalValue,
  onAccept,
  onCancel,
}) => {
  'use memo';

  const filenames = useAppSelector(files.filenamesSelector);
  const validate = (name: string) =>
    validateDirRename(filenames, { from: originalValue, to: name });

  return (
    <NameInput
      Icon={Icon}
      labels={DIRNAME_INPUT_LABELS}
      defaultValue={defaultValue}
      originalValue={originalValue}
      validate={validate}
      describeError={describeError}
      onAccept={onAccept}
      onCancel={onCancel}
    />
  );
};

interface PathButtonProps {
  path: filesRules.Path;
  onClick: () => void;
  children: React.ReactNode;
}

const PathButton: React.FC<PathButtonProps> = ({ path, onClick, children }) => {
  'use memo';

  const activeFile = useAppSelector(files.activeFilePathSelector);

  const focus = useAtomValue(focusAtom);
  const startRename = useSetAtom(startRenameAtom);

  const isFocus = focus?.absolute === path.absolute ? true : undefined;
  const isActive = activeFile?.absolute === path.absolute ? true : undefined;

  return (
    <button
      className={styles.button}
      data-focus={isFocus}
      onClick={(evt) => {
        if (evt.detail === 1) {
          onClick();
        } else if (evt.detail === 2) {
          startRename();
        }
      }}
      title={path.absolute}
    >
      <span className={styles.name} data-active={isActive}>
        {children}
      </span>
    </button>
  );
};

const FilePathIcon = () => <Icons.File className={styles.icon} />;

interface FilePathProps {
  path: filesRules.FilePath;
}

const FilePath: React.FC<FilePathProps> = ({ path }) => {
  'use memo';

  const dispatch = useAppDispatch();
  const setFocus = useSetAtom(focusAtom);
  const rename = useAtomValue(renameAtom);
  const cancelRename = useSetAtom(cancelRenameAtom);

  if (rename?.absolute === path.absolute) {
    return (
      <div className={styles.name}>
        <FilenameInput
          Icon={FilePathIcon}
          kind="rename"
          defaultValue={path.absolute}
          originalValue={path.absolute}
          onAccept={(to) => dispatch(filesActions.renameFile({ from: path.absolute, to }))}
          onCancel={cancelRename}
        />
      </div>
    );
  } else {
    return (
      <PathButton
        path={path}
        onClick={() => {
          setFocus(path);
          dispatch(filesActions.activateFile(path.absolute));
        }}
      >
        <FilePathIcon /> {path.name}
      </PathButton>
    );
  }
};

const DirPathIcon = () => <Icons.Directory className={styles.icon} />;

interface DirPathProps {
  path: filesRules.DirPath;
}

const DirPath: React.FC<DirPathProps> = ({ path }) => {
  'use memo';

  const dispatch = useAppDispatch();
  const setFocus = useSetAtom(focusAtom);
  const rename = useAtomValue(renameAtom);
  const cancelRename = useSetAtom(cancelRenameAtom);

  if (rename?.absolute === path.absolute) {
    return (
      <div className={styles.name}>
        <DirnameInput
          Icon={DirPathIcon}
          defaultValue={path.absolute}
          originalValue={path.absolute}
          onAccept={(to) => dispatch(filesActions.renameDirectory({ from: path.absolute, to }))}
          onCancel={cancelRename}
        />
      </div>
    );
  } else {
    return (
      <PathButton path={path} onClick={() => setFocus(path)}>
        <DirPathIcon /> {path.name}/
      </PathButton>
    );
  }
};

interface PathsProps {
  paths: filesRules.Path[];
}

const Paths: React.FC<PathsProps> = ({ paths }) => {
  'use memo';

  if (paths.length === 0) {
    return <p className={styles.emptyPaths}>No files have been created yet.</p>;
  }

  const kids = paths.map((p) => {
    const child = p.kind === 'file' ? <FilePath path={p} /> : <DirPath path={p} />;

    const style = { '--depth': p.parentNames.length } as React.CSSProperties;

    return (
      <li key={p.absolute} style={style}>
        {child}
      </li>
    );
  });

  return <ol className={styles.paths}>{kids}</ol>;
};

interface RemoveDialogLabels {
  message: string;
  remove: string;
  cancel: string;
}

interface RemoveDialogProps {
  labels: RemoveDialogLabels;
  onRemove: () => void;
  ref: React.RefObject<HTMLDialogElement | null>;
}

const RemoveDialog: React.FC<RemoveDialogProps> = ({ labels, onRemove, ref }) => {
  'use memo';

  // This can be replaced with the Invoker API [1] once it's been
  // stable long enough. (invoker-api)
  //
  // https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API
  const accept = () => {
    onRemove();
    ref.current?.close();
  };

  // See (invoker-api)
  const cancel = () => {
    ref.current?.close();
  };

  return (
    <dialog className={styles.dialog} ref={ref}>
      <div className={styles.dialogContent}>
        <p className={styles.dialogText}>{labels.message}</p>
        <p className={styles.dialogTip}>
          Tip: shift-click the remove icon to skip this confirmation dialog.
        </p>
        <button className={styles.dialogCancel} onClick={cancel}>
          {labels.cancel}
        </button>
        <button autoFocus className={styles.dialogAccept} onClick={accept}>
          {labels.remove}
        </button>
      </div>
    </dialog>
  );
};

const newFileSuggestion = (selectedPath: filesRules.Path | null) => {
  if (!selectedPath) {
    return 'src/main.rs';
  }

  const pathParts = [...selectedPath.parentNames];

  if (selectedPath.kind === 'file') {
    const [_prefix, suffix] = filesRules.filenameSplitAtDot(selectedPath.name);
    const newFile = 'file' + suffix;
    pathParts.push(newFile);
  } else {
    pathParts.push(selectedPath.name, 'file.rs');
  }

  return pathParts.join('/');
};

const REMOVE_LABELS = {
  file: {
    message: 'Would you like to remove this file? The contents will be lost.',
    remove: 'Remove File',
    cancel: 'Keep File',
  },
  dir: {
    message:
      'Would you like to remove this directory? All children files and directories will be removed and their contents will be lost.',
    remove: 'Remove Directory',
    cancel: 'Keep Directory',
  },
};

const focusAtom = atom<filesRules.Path | null>(null);

const isAddingAtom = atom(false);
const startAddingAtom = atom(false, (_get, set) => {
  set(isAddingAtom, true);
});
const cancelAddingAtom = atom(false, (_get, set) => {
  set(isAddingAtom, false);
});

const renameAtom = atom<filesRules.Path | null>(null);
const startRenameAtom = atom(null, (get, set) => {
  set(renameAtom, get(focusAtom));
});
const cancelRenameAtom = atom(null, (_get, set) => {
  set(renameAtom, null);
});

const FileTree: React.FC = () => {
  'use memo';

  const dispatch = useAppDispatch();

  const paths = useAppSelector(files.filetreeSelector);
  const activeFile = useAppSelector(files.activeFilePathSelector);
  const [focus, setFocus] = useAtom(focusAtom);
  const isAdding = useAtomValue(isAddingAtom);

  const dialog = useRef<HTMLDialogElement>(null);

  const startAdd = useSetAtom(startAddingAtom);
  const acceptAdd = (newName: string) => dispatch(filesActions.createFile(newName));
  const cancelAdd = useSetAtom(cancelAddingAtom);

  const startRename = useSetAtom(startRenameAtom);

  const remove = () => {
    if (!focus) {
      return;
    }
    if (focus.kind === 'file') {
      dispatch(filesActions.deleteFile(focus.absolute));
    } else {
      dispatch(filesActions.deleteDirectory(focus.absolute));
    }
  };
  const startRemove = (evt: React.MouseEvent) => {
    if (evt.shiftKey) {
      remove();
    } else {
      dialog.current?.showModal();
    }
  };

  // If someone changes the active file from outside, such as when a
  // file is deleted, update the focus to follow.
  const focusOnActive = useEffectEvent(() => {
    if (focus?.absolute !== activeFile?.absolute) {
      setFocus(activeFile ?? null);
    }
  });
  useEffect(() => focusOnActive(), [activeFile?.absolute]);

  const suggestedFilePath = newFileSuggestion(focus);
  const focusedLabel = focus?.kind === 'file' ? 'file' : 'directory';

  return (
    <div className={styles.container} data-test-id="filetree">
      <div className={styles.actions}>
        <span className={styles.actionsHeader}>Files</span>
        <button className={styles.iconButton} onClick={startAdd} title="Create file">
          <Icons.FileAdd />
        </button>
        <button
          className={styles.iconButton}
          onClick={startRemove}
          title={`Remove selected ${focusedLabel}`}
        >
          <Icons.DeleteForever />
        </button>
        <button
          className={styles.iconButton}
          onClick={startRename}
          title={`Rename selected ${focusedLabel}`}
        >
          <Icons.Edit />
        </button>
      </div>
      <Paths paths={paths} />
      {isAdding ? (
        <FilenameInput
          kind="create"
          defaultValue={suggestedFilePath}
          onAccept={acceptAdd}
          onCancel={cancelAdd}
        />
      ) : null}
      {focus && <RemoveDialog ref={dialog} labels={REMOVE_LABELS[focus.kind]} onRemove={remove} />}
    </div>
  );
};

export default FileTree;
