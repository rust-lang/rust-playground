import { PayloadAction, WritableDraft, createSlice } from '@reduxjs/toolkit';

import {
  Rename,
  arrayIsPrefix,
  makeFilePath,
  makeValidatedDirRenamer,
  validateFilename,
} from '../domain/filesRules';
import { FileId } from '../types';

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

    deleteFile: (state, action: PayloadAction<string>) => {
      state.files = state.files.filter((f) => f.name !== action.payload);
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

    deleteDirectory: (state, action: PayloadAction<string>) => {
      const dirParts = action.payload.split('/');

      state.files = state.files.filter((f) => {
        const path = makeFilePath(f.name);
        return !arrayIsPrefix(dirParts, path.parentNames);
      });

      fixupAfterDeletion(state);
    },

    activateFile: (state, action: PayloadAction<string>) => {
      const file = state.files.find((f) => f.name === action.payload);
      if (file) {
        state.active = file.id;
      }
    },
  },
});

export const {
  activateFile,
  createFile,
  deleteDirectory,
  deleteFile,
  renameDirectory,
  renameFile,
} = slice.actions;

export default slice.reducer;
