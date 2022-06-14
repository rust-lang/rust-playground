import { semanticTokensLegend } from '../editor/rust_monaco_def';
import * as Monaco from 'monaco-editor';
import { downloadCodeOfCrate, selectedVersion } from './crates';
import { getIntellisenseConfig, isEnable } from './config';

const modeId = 'rust';

// Create an RA Web worker
const createRA = async () => {
  const worker = new Worker(new URL('./ra-worker.js', import.meta.url));
  const pendingResolve = {};

  let id = 1;
  let ready;

  const callWorker = async (which, ...args) => {
    return new Promise((resolve, _) => {
      pendingResolve[id] = resolve;
      worker.postMessage({
        which,
        args,
        id,
      });
      id += 1;
    });
  }

  const proxyHandler = {
    get: (target, prop, _receiver) => {
      if (prop == 'then') {
        return Reflect.get(target, prop, _receiver);
      }
      return async (...args) => {
        return callWorker(prop, ...args);
      }
    },
  }

  worker.onmessage = (e) => {
    if (e.data.id == 'ra-worker-ready') {
      ready(new Proxy({}, proxyHandler));
      return;
    }
    const pending = pendingResolve[e.data.id];
    if (pending) {
      pending(e.data.result);
      delete pendingResolve[e.data.id];
    }
  }

  return new Promise((resolve, _) => {
    ready = resolve;
  });
}

const registerRA = (monaco: typeof Monaco, state: any) => {
  monaco.languages.registerHoverProvider(modeId, {
    provideHover: (_, pos) => state.hover(pos.lineNumber, pos.column),
  });
  monaco.languages.registerCodeLensProvider(modeId, {
    async provideCodeLenses(m) {
      const code_lenses = await state.code_lenses();
      const lenses = code_lenses.map(({ range, command }) => {
        const position = {
          column: range.startColumn,
          lineNumber: range.startLineNumber,
        };

        const references = command.positions.map((pos) => ({ range: pos, uri: m.uri }));
        return {
          range,
          command: {
            id: command.id,
            title: command.title,
            arguments: [
              m.uri,
              position,
              references,
            ],
          },
        };
      });

      return { lenses, dispose() { /* do nothing */ } };
    },
  });
  monaco.languages.registerReferenceProvider(modeId, {
    async provideReferences(m, pos, { includeDeclaration }) {
      const references = await state.references(pos.lineNumber, pos.column, includeDeclaration);
      if (references) {
        return references.map(({ range }) => ({ uri: m.uri, range }));
      }
    },
  });
  monaco.languages.registerInlayHintsProvider(modeId, {
    async provideInlayHints() {
      const hints = await state.inlay_hints();
      console.log('finished inlay');
      return hints.map((hint: any) => {
        if (hint.hint_type == 1) {
          return {
            kind: 1,
            position: { column: hint.range.endColumn, lineNumber: hint.range.endLineNumber },
            text: `: ${hint.label}`,
          };
        }
        if (hint.hint_type == 2) {
          return {
            kind: 2,
            position: { column: hint.range.startColumn, lineNumber: hint.range.startLineNumber },
            text: `${hint.label}:`,
            whitespaceAfter: true,
          };
        }
      })
    },
  });
  monaco.languages.registerDocumentHighlightProvider(modeId, {
    async provideDocumentHighlights(_, pos) {
      return await state.references(pos.lineNumber, pos.column, true);
    },
  });
  monaco.languages.registerRenameProvider(modeId, {
    async provideRenameEdits(m, pos, newName) {
      const edits = await state.rename(pos.lineNumber, pos.column, newName);
      if (edits) {
        return {
          edits: edits.map(edit => ({
            resource: m.uri,
            edit,
          })),
        };
      }
    },
    async resolveRenameLocation(_, pos) {
      return state.prepare_rename(pos.lineNumber, pos.column);
    },
  });
  monaco.languages.registerCompletionItemProvider(modeId, {
    triggerCharacters: ['.', ':', '='],
    async provideCompletionItems(_m, pos) {
      const suggestions = await state.completions(pos.lineNumber, pos.column);
      if (suggestions) {
        return { suggestions };
      }
    },
  });
  monaco.languages.registerSignatureHelpProvider(modeId, {
    signatureHelpTriggerCharacters: ['(', ','],
    async provideSignatureHelp(_m, pos) {
      const value = await state.signature_help(pos.lineNumber, pos.column);
      if (!value) return null;
      return {
        value,
        dispose() { /* do nothing */ },
      };
    },
  });
  monaco.languages.registerDefinitionProvider(modeId, {
    async provideDefinition(m, pos) {
      const list = await state.definition(pos.lineNumber, pos.column);
      if (list) {
        return list.map(def => ({ ...def, uri: m.uri }));
      }
    },
  });
  monaco.languages.registerTypeDefinitionProvider(modeId, {
    async provideTypeDefinition(m, pos) {
      const list = await state.type_definition(pos.lineNumber, pos.column);
      if (list) {
        return list.map(def => ({ ...def, uri: m.uri }));
      }
    },
  });
  monaco.languages.registerImplementationProvider(modeId, {
    async provideImplementation(m, pos) {
      const list = await state.goto_implementation(pos.lineNumber, pos.column);
      if (list) {
        return list.map(def => ({ ...def, uri: m.uri }));
      }
    },
  });
  monaco.languages.registerDocumentSymbolProvider(modeId, {
    async provideDocumentSymbols() {
      return await state.document_symbols();
    },
  });
  monaco.languages.registerOnTypeFormattingEditProvider(modeId, {
    autoFormatTriggerCharacters: ['.', '='],
    async provideOnTypeFormattingEdits(_, pos, ch) {
      return await state.type_formatting(pos.lineNumber, pos.column, ch);
    },
  });
  monaco.languages.registerFoldingRangeProvider(modeId, {
    async provideFoldingRanges() {
      return await state.folding_ranges();
    },
  });
  monaco.languages.registerDocumentSemanticTokensProvider(modeId, {
    getLegend() {
      return semanticTokensLegend;
    },
    async provideDocumentSemanticTokens() {
      const data = await state.semantic_tokens();
      console.log(data);
      return { data };
    },
    releaseDocumentSemanticTokens() { /* do nothing */ },
  });
};

export const enableOnMonaco = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
  if (!isEnable()) {
    return;
  }
  const model = editor.getModel();
  let state = null;

  async function update() {
    const res = await state.update(model.getValue());
    if (getIntellisenseConfig().diagnostic) {
      monaco.editor.setModelMarkers(model, modeId, res.diagnostics);
    }
  }
  const initRA = async () => {
    state = await createRA();
    await state.init(model.getValue());
    registerRA(monaco, state);
    await update();
    model.onDidChangeContent(update);
    await new Promise((res) => setTimeout(res, 500));
    const libstdVersion = await selectedVersion('stdlib');
    await state.update_crate_code('std', await downloadCodeOfCrate('std', libstdVersion));
    await state.update_crate_code('core', await downloadCodeOfCrate('core', libstdVersion));
    await state.update_crate_code('alloc', await downloadCodeOfCrate('alloc', libstdVersion));
    console.log('std lib will be loaded on next update');
    await state.semantic_tokens();
    // HACK: reload semantic data
    const pos = editor.getPosition();
    model.setValue(model.getValue());
    editor.setPosition(pos);
  };
  initRA();
};

