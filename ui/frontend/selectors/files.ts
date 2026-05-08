import { createSelector } from '@reduxjs/toolkit';

import { filenamesToTree, makeFilePath } from '../domain/filesRules';
import { State } from '../reducers';

const activeFileIdSelector = (state: State) => state.files.active;

const filesSelector = (state: State) => state.files.files;

export const activeFileSelector = createSelector(filesSelector, activeFileIdSelector, (files, id) =>
  files.find((f) => f.id === id),
);

export const activeFilePathSelector = createSelector(
  activeFileSelector,
  (f) => f && makeFilePath(f.name),
);

export const filenamesSelector = createSelector(filesSelector, (c) => c.map((f) => f.name));

export const filetreeSelector = createSelector(filenamesSelector, filenamesToTree);
