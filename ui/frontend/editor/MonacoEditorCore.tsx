import * as monaco from 'monaco-editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppSelector } from '../hooks';
import { offerCrateAutocompleteOnUse } from '../selectors';
import { CommonEditorProps, FileId } from '../types';
import { themeVsDarkPlus } from './rust_monaco_def';
import { useLatest } from './useLatest';

import * as styles from './Editor.module.css';

async function remeasureFontWhenReady(fonts: FontFaceSet, font: string) {
  while (!fonts.check(font)) {
    await fonts.ready;
  }

  monaco.editor.remeasureFonts();
}

function useEditorProp<T>(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  prop: T,
  whenPresent: (
    editor: monaco.editor.IStandaloneCodeEditor,
    model: monaco.editor.ITextModel,
    prop: T,
  ) => void | (() => void),
) {
  useEffect(() => {
    if (!editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    return whenPresent(editor, model, prop);
  }, [editor, prop, whenPresent]);
}

interface EditorState {
  model: monaco.editor.ITextModel;
  viewState: monaco.editor.ICodeEditorViewState | null;
  position: monaco.Position | null;
  selections: monaco.Selection[] | null;
  readonly dispose: () => void;
}

const MonacoEditorCore: React.FC<CommonEditorProps> = (props) => {
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const stateCache = useRef<Map<FileId, EditorState>>(new Map());
  const theme = useAppSelector((s) => s.configuration.monaco.theme);
  const completionProvider = useRef<monaco.IDisposable | null>(null);
  const autocompleteOnUse = useAppSelector(offerCrateAutocompleteOnUse);

  const latestActiveFileIdRef = useLatest(props.activeFileId);
  const latestCodeRef = useLatest(props.code);
  const latestThemeRef = useLatest(theme);

  // One-time setup
  useEffect(() => {
    monaco.editor.defineTheme('vscode-dark-plus', themeVsDarkPlus);
  }, []);

  const createCachedState = useCallback(() => {
    const activeFileId = latestActiveFileIdRef.current;
    const cache = stateCache.current;

    if (!cache.has(activeFileId)) {
      cache.set(activeFileId, {
        model: monaco.editor.createModel(latestCodeRef.current, 'rust'),
        viewState: null,
        selections: null,
        position: null,
        dispose() {
          this.model.dispose();
        },
      });
    }

    return cache.get(activeFileId)!;
  }, [latestActiveFileIdRef, latestCodeRef]);

  // Construct the editor
  const child = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }

      const nodeStyle = window.getComputedStyle(node);

      const { model } = createCachedState();

      const editor = monaco.editor.create(node, {
        model,
        theme: latestThemeRef.current,
        fontSize: parseInt(nodeStyle.fontSize, 10),
        fontFamily: nodeStyle.fontFamily,
        automaticLayout: true,
        'semanticHighlighting.enabled': true,
        autoClosingOvertype: 'always',
      });
      setEditor(editor);

      remeasureFontWhenReady(document.fonts, nodeStyle.font);

      editor.focus();
    },
    [createCachedState, latestThemeRef],
  );

  useEditorProp(
    editor,
    props.activeFileId,
    useCallback(
      (editor, _model, _activeFileId) => {
        const oldModel = editor.getModel();
        if (oldModel) {
          const oldState = stateCache.current.values().find((s) => s.model.id === oldModel.id);
          if (oldState) {
            oldState.viewState = editor.saveViewState();
            oldState.position = editor.getPosition();
            oldState.selections = editor.getSelections();
          }
        }

        const { model, viewState, selections, position } = createCachedState();

        editor.setModel(model);
        editor.restoreViewState(viewState);
        if (position) {
          editor.setPosition(position);
        }
        if (selections) {
          editor.setSelections(selections);
        }
      },
      [createCachedState],
    ),
  );

  // Dispose cached states that have been removed
  useEffect(() => {
    for (const [cachedFileId, session] of stateCache.current) {
      if (!props.fileIds.includes(cachedFileId)) {
        session.dispose();
        stateCache.current.delete(cachedFileId);
      }
    }
  }, [props.fileIds]);

  // Dispose all cached states when we unmount
  useEffect(() => {
    const cache = stateCache;
    return () => {
      for (const state of cache.current.values()) {
        state.dispose();
      }
      cache.current.clear();
    };
  }, []);

  useEditorProp(
    editor,
    props.onEditCode,
    useCallback((editor, _model, onEditCode) => {
      editor.onDidChangeModelContent(() => {
        // Must get the current model, not whatever model was active
        // when we set up the callback.
        const value = editor.getModel()?.getValue();
        if (value) {
          onEditCode(value);
        }
      });
    }, []),
  );

  useEditorProp(
    editor,
    props.execute,
    useCallback((editor, _model, execute) => {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        execute();
      });
      // Ace's Vim mode runs code with :w, so let's do the same
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        execute();
      });
    }, []),
  );

  useEditorProp(
    editor,
    props.code,
    useCallback((editor, model, code) => {
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
    }, []),
  );

  useEditorProp(
    editor,
    theme,
    useCallback((editor, _model, theme) => {
      editor.updateOptions({ theme });
    }, []),
  );

  const autocompleteProps = useMemo(
    () => ({ autocompleteOnUse, crates: props.crates }),
    [autocompleteOnUse, props.crates],
  );

  useEditorProp(
    editor,
    autocompleteProps,
    useCallback((_editor, _model, { autocompleteOnUse, crates }) => {
      completionProvider.current = monaco.languages.registerCompletionItemProvider('rust', {
        triggerCharacters: [' '],

        provideCompletionItems(model, position, _context, _token) {
          const word = model.getWordUntilPosition(position);

          function wordBefore(
            word: monaco.editor.IWordAtPosition,
          ): monaco.editor.IWordAtPosition | null {
            const prevPos = { lineNumber: position.lineNumber, column: word.startColumn - 1 };
            return model.getWordAtPosition(prevPos);
          }

          const preWord = wordBefore(word);
          const prePreWord = preWord && wordBefore(preWord);

          const oldStyle = prePreWord?.word === 'extern' && preWord?.word === 'crate';
          const newStyle = autocompleteOnUse && preWord?.word === 'use';

          const triggerPrefix = oldStyle || newStyle;

          if (!triggerPrefix) {
            return { suggestions: [] };
          }

          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = crates.map(({ name, version, id }) => ({
            kind: monaco.languages.CompletionItemKind.Module,
            label: `${name} (${version})`,
            insertText: `${id}; // ${version}`,
            range,
          }));

          return { suggestions };
        },
      });

      return () => {
        completionProvider.current?.dispose();
      };
    }, []),
  );

  useEditorProp(
    editor,
    props.position,
    useCallback((editor, _model, { line, column }) => {
      editor.setPosition({ lineNumber: line, column });
      editor.focus();
    }, []),
  );

  return <div className={styles.monaco} ref={child} />;
};

export default MonacoEditorCore;
