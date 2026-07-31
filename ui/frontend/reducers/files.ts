import { PayloadAction, WritableDraft, createSlice } from '@reduxjs/toolkit';

import { ThunkAction } from '../actions';
import {
  Rename,
  arrayIsPrefix,
  makeFilePath,
  makeValidatedDirRenamer,
  validateFilename,
} from '../domain/filesRules';
import { FileId } from '../types';
import { HELLO_WORLD, addCrateType, addMainFunction, doAddCrateType } from './code';
import { performFormat } from './output/format';
import { performGistLoad } from './output/gist';

const filenames = (state: State): string[] => state.files.map((f) => f.name);

const isFilenameValid = (state: State, candidateName: string): boolean =>
  validateFilename(filenames(state), candidateName) === null;

const validateDirRename = (state: State, rename: Rename) =>
  makeValidatedDirRenamer(filenames(state), rename);

const selectActiveFile = (files: File[]) => {
  let main;
  let lib;
  for (const f of files) {
    if (f.name === 'src/main.rs') {
      main = f;
    } else if (f.name === 'src/lib.rs') {
      lib = f;
    }

    if (main && lib) {
      break;
    }
  }

  if (main) {
    return main.id;
  } else if (lib) {
    return lib.id;
  } else {
    return files.at(0)?.id ?? null;
  }
};

// Ensure that the active file is still a file we have.
const fixupAfterDeletion = (state: WritableDraft<State>) => {
  const activeStillValid = state.files.some((f) => f.id === state.active);
  if (!activeStillValid) {
    state.active = selectActiveFile(state.files);
  }
};

const buildFile = (state: WritableDraft<State>, name: string, content = '') => ({
  id: state.fileId++,
  name,
  content,
});

interface File {
  readonly id: FileId;
  name: string;
  content: string;
}

interface State {
  fileId: FileId;
  active: FileId | null;
  files: File[];
}

const initialState: State = {
  fileId: 0,
  active: null,
  files: [],
};

const slice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    initializeWith: (state, action: PayloadAction<{ name: string; content: string }>) => {
      const { name, content } = action.payload;

      if (!isFilenameValid(state, name)) {
        return;
      }

      const newFile = buildFile(state, name, content);
      state.files = [newFile];
      state.active = newFile.id;
    },

    editActiveFile: (state, action: PayloadAction<string>) => {
      const file = state.files.find((f) => f.id === state.active);
      if (file) {
        file.content = action.payload;
      }
    },

    createFile: (state, action: PayloadAction<string>) => {
      const candidateName = action.payload;

      if (!isFilenameValid(state, candidateName)) {
        return;
      }

      const newFile = buildFile(state, candidateName);
      state.files.push(newFile);
      state.active = newFile.id;
    },

    renameFile: (state, action: PayloadAction<Rename>) => {
      const { from, to } = action.payload;

      const fromFile = state.files.find((f) => f.name === from);

      // Does the source exist?
      if (!fromFile) {
        return;
      }

      // No-op
      if (from === to) {
        return;
      }

      if (!isFilenameValid(state, to)) {
        return;
      }

      fromFile.name = to;
    },

    deleteFileIds: (state, action: PayloadAction<FileId[]>) => {
      state.files = state.files.filter((f) => !action.payload.includes(f.id));
      fixupAfterDeletion(state);
    },

    // It's not an error to rename a directory that doesn't exist and
    // the UI doesn't even show the option to rename something that
    // doesn't exist.
    renameDirectory: (state, action: PayloadAction<Rename>) => {
      const rename = action.payload;

      // No-op
      if (rename.from === rename.to) {
        return;
      }

      const r = validateDirRename(state, rename);
      if (!r.ok) {
        return;
      }
      const performDirRename = r.value;

      for (const file of state.files) {
        file.name = performDirRename(file.name);
      }
    },

    activateFile: (state, action: PayloadAction<string>) => {
      const file = state.files.find((f) => f.name === action.payload);
      if (file) {
        state.active = file.id;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addMainFunction, (state) => {
        const existing = state.files.find((f) => f.name === 'src/main.rs');

        let file;
        if (existing) {
          file = existing;
        } else {
          file = buildFile(state, 'src/main.rs', HELLO_WORLD);
          state.files.push(file);
        }

        state.active = file.id;
      })
      .addCase(addCrateType, (state, action) => {
        const file = state.files.find((f) => f.name === 'src/lib.rs');
        if (file) {
          file.content = doAddCrateType(file.content, action.payload);
        }
      })
      .addCase(performGistLoad.pending, (state) => {
        state.active = null;
        state.files = [];
      })
      .addCase(performGistLoad.fulfilled, (state, action) => {
        if (typeof action.payload.code !== 'string') {
          state.files = action.payload.code.map((f) => buildFile(state, f.name, f.content));
          state.active = selectActiveFile(state.files);
        }
      })
      .addCase(performFormat.fulfilled, (state, action) => {
        if (typeof action.payload.code !== 'string') {
          const formattedFiles = action.payload.code;
          for (const f of state.files) {
            const formattedFile = formattedFiles.find((ff) => ff.name === f.name);
            if (formattedFile) {
              f.content = formattedFile.content;
            }
          }
          // we expect that active remains correct,
        }
      });
  },
});

export const deleteFile =
  (filename: string): ThunkAction =>
  (dispatch, getState) => {
    const state = getState();

    const ids = state.files.files.flatMap((f) => (f.name === filename ? [f.id] : []));

    dispatch(deleteFileIds(ids));
  };

export const deleteDirectory =
  (dirname: string): ThunkAction =>
  (dispatch, getState) => {
    const state = getState();
    const dirParts = dirname.split('/');

    const ids = state.files.files.flatMap((f) => {
      const path = makeFilePath(f.name);
      return arrayIsPrefix(dirParts, path.parentNames) ? [f.id] : [];
    });

    dispatch(deleteFileIds(ids));
  };

export const deleteAll = (): ThunkAction => (dispatch, getState) => {
  const state = getState();

  const ids = state.files.files.map((f) => f.id);

  dispatch(deleteFileIds(ids));
};

export const {
  activateFile,
  createFile,
  deleteFileIds,
  editActiveFile,
  initializeWith,
  renameDirectory,
  renameFile,
} = slice.actions;

export default slice.reducer;
