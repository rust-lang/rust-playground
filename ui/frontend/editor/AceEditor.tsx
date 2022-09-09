import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { aceResizeKey, offerCrateAutocompleteOnUse } from '../selectors';

import State from '../state';
import { AceResizeKey, Crate, PairCharacters, Position, Selection } from '../types';

import styles from './Editor.module.css';

type Ace = typeof import('ace-builds');
type AceModule = import('ace-builds').Ace.Editor;
type AceCompleter = import('ace-builds').Ace.Completer;
type AceCompletion = import('ace-builds').Ace.Completion;

interface CodeMirrorEditor {
  ace: AceModule;
}

interface VimKeybindings {
  CodeMirror: {
    Vim: {
      defineEx: (cmd: string, key: string, cb: (cm: CodeMirrorEditor) => void) => void;
    };
  };
}

const displayExternCrateAutocomplete = (editor: AceModule, autocompleteOnUse: boolean) => {
  const { session } = editor;
  const pos = editor.getCursorPosition();
  const line = session.getLine(pos.row);
  const precedingText = line.slice(0, pos.column);

  return !!precedingText.match(/^\s*extern\s+crate\s*\w*$/) ||
    (autocompleteOnUse && !!precedingText.match(/^\s*use\s+(?!crate|self|super)\w*$/));
};

const buildCrateAutocompleter = (autocompleteOnUse: boolean, crates: Crate[]): AceCompleter => ({
  getCompletions: (editor, _session, _pos, _prefix, callback) => {
    let suggestions: AceCompletion[] = [];

    if (displayExternCrateAutocomplete(editor, autocompleteOnUse)) {
      const len = crates.length;

      suggestions = crates.map(({ name, version, id }, i) => ({
        caption: `${name} (${version})`,
        value: `${id}; // ${version}`,
        meta: 'crate',
        score: len - i, // Force alphabetic order before anything is typed
      }));
    }

    callback(null, suggestions);
  },
});

function useRafDebouncedFunction<A extends any[]>(fn: (...args: A) => void, onCall?: (...args: A) => void) {
  const timeout = useRef<number>();

  return useCallback((...args: A): void => {
    if (timeout.current) {
      window.cancelAnimationFrame(timeout.current);
    }

    timeout.current = window.requestAnimationFrame(() => {
      fn(...args);
      if (onCall) { onCall(...args); }
    });
  }, [fn, onCall, timeout]);
}

interface AceEditorProps extends AceEditorAsyncProps {
  ace: Ace;
}

interface AceEditorProps {
  ace: Ace;
  autocompleteOnUse: boolean;
  code: string;
  execute: () => any;
  keybinding: string;
  onEditCode: (_: string) => any;
  position: Position;
  selection: Selection;
  theme: string;
  crates: Crate[];
  resizeKey?: AceResizeKey;
  pairCharacters: PairCharacters;
}

// Run an effect when the editor or prop changes
function useEditorProp<T>(editor: AceModule | null, prop: T, whenPresent: (editor: AceModule, prop: T) => void) {
  useEffect(() => {
    if (editor) {
      return whenPresent(editor, prop);
    }
  }, [editor, prop, whenPresent]);
}

const AceEditor: React.FC<AceEditorProps> = props => {
  const [editor, setEditor] = useState<AceModule | null>(null);
  const child = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!child.current) { return; }

    const editor = props.ace.edit(child.current, {
      mode: 'ace/mode/rust',
    });
    setEditor(editor);

    // The default keybinding of control/command-l interferes with
    // the browser's "edit the location" keycommand which I think
    // is way more common.
    const gotoCommand = editor.commands.byName.gotoline;
    gotoCommand.bindKey = {
      win: 'Ctrl-Shift-L',
      mac: 'Command-Shift-L',
    };
    editor.commands.addCommand(gotoCommand);

    editor.setOptions({
      enableBasicAutocompletion: true,
      fixedWidthGutter: true,
    });

    const danglingElement = child.current;

    return () => {
      editor.destroy();
      setEditor(null);
      danglingElement.textContent = '';
    };
  }, [props.ace, child]);

  useEditorProp(editor, props.execute, useCallback((editor, execute) => {
    // TODO: Remove command?
    editor.commands.addCommand({
      name: 'executeCode',
      bindKey: {
        win: 'Ctrl-Enter',
        mac: 'Ctrl-Enter|Command-Enter',
      },
      exec: execute,
      readOnly: true,
    });
  }, []));

  const autocompleteProps = useMemo(() => ({
    autocompleteOnUse: props.autocompleteOnUse,
    crates: props.crates,
  }), [props.autocompleteOnUse, props.crates]);

  // When the user types either `extern crate ` or `use `, automatically
  // open the autocomplete. This should help people understand that
  // there are crates available.
  useEditorProp(editor, autocompleteProps, useCallback((editor, { autocompleteOnUse, crates }) => {
    editor.commands.on('afterExec', ({ editor, command }) => {
      if (!(command.name === 'backspace' || command.name === 'insertstring')) {
        return;
      }

      if (displayExternCrateAutocomplete(editor, autocompleteOnUse)) {
        editor.execCommand('startAutocomplete');
      }
    });

    editor.completers = [buildCrateAutocompleter(autocompleteOnUse, crates)];
  }, []));

  // Both Ace and the playground want to be the One True Owner of
  // the textual content. This can cause issues because the Redux
  // store will attempt to change Ace in response to changes
  // *originating* from Ace. In addition, Ace can generate multiple
  // `change` events in response to what looks like a single user
  // action. This includes:
  //
  // - Auto-indenting after pressing return
  // - Invoking undo
  // - Multi-cursor editing
  //
  // To avoid issues...
  //
  // 1. When we are setting the Ace value based on the prop, we
  //    prevent generating outgoing events. This requires that the
  //    events are synchronously generated during the call to
  //    `setValue`
  //
  // 2. We throttle outgoing events to once per animation frame,
  //    only sending the most recent update. This reduces the updates
  //    to Redux and thus the number of updates to our props. While
  //    this covers a lot of the problems, it does not handle rapid
  //    typing (a.k.a. banging on the keyboard).
  //
  // 3. When we do generate an outgoing event, we log it. If we see
  //    that same event come back next via the property, we ignore it.
  //
  // 4. When all else fails, we ignore the prop if the value to set is
  //    what Ace already has.
  const doingSetProp = useRef(false);
  const previouslyNotified = useRef<string[]>([]);
  const onEditCodeDebounced = useRafDebouncedFunction(
    props.onEditCode,
    useCallback(code => previouslyNotified.current.push(code), [previouslyNotified]),
  );

  useEditorProp(editor, onEditCodeDebounced, useCallback((editor, onEditCode) => {
    const listener = () => {
      if (!doingSetProp.current) {
        onEditCode(editor.getValue());
      }
    };

    editor.on('change', listener);

    return () => {
      editor.off('change', listener);
    };
  }, []));

  useEditorProp(editor, props.code, useCallback((editor, code) => {
    // Is this prop update the result of our own `change` event?
    const last = previouslyNotified.current.shift();
    if (code === last) {
      return;
    }

    // It wasn't; discard any remaining self-generated events and resync
    previouslyNotified.current = [];

    // Avoid spuriously resetting the text
    if (editor.getValue() === code) {
      return;
    }

    doingSetProp.current = true;
    const currentSelection = editor.selection.toJSON();
    editor.setValue(code);
    editor.selection.fromJSON(currentSelection);
    doingSetProp.current = false;
  }, []));

  useEditorProp(editor, props.theme, useCallback((editor, theme) => {
    editor.setTheme(`ace/theme/${theme}`);
  }, []));

  const keybindingProps = useMemo(() => ({
    keybinding: props.keybinding,
    ace: props.ace,
  }), [props.keybinding, props.ace]);

  useEditorProp(editor, keybindingProps, useCallback((editor, { keybinding, ace }) => {
    const handler = keybinding === 'ace' ? null : `ace/keyboard/${keybinding}`;
    editor.setOption('keyboardHandler', handler);

    if (keybinding === 'vim') {
      const { CodeMirror: { Vim } }: VimKeybindings = ace.require('ace/keyboard/vim');
      Vim.defineEx('write', 'w', (cm) => {
        cm.ace.execCommand('executeCode');
      });
    }
  }, []));

  useEditorProp(editor, props.pairCharacters, useCallback((editor, pairCharacters) => {
    editor.setBehavioursEnabled(pairCharacters !== PairCharacters.Disabled);
  }, []));

  useEditorProp(editor, props.position, useCallback((editor, { line, column }) => {
    // Columns are zero-indexed in ACE
    editor.gotoLine(line, column - 1, false);
    editor.focus();
  }, []));

  const selectionProps = useMemo(() => ({
    selection: props.selection,
    ace: props.ace,
  }), [props.selection, props.ace]);

  useEditorProp(editor, selectionProps, useCallback((editor, { ace, selection }) => {
    if (selection.start && selection.end) {
      // Columns are zero-indexed in ACE, but why does the selection
      // API and `gotoLine` treat the row/line differently?
      const toPoint = ({ line, column }: Position) => ({ row: line - 1, column: column - 1 });

      const start = toPoint(selection.start);
      const end = toPoint(selection.end);

      const range = new ace.Range(start.row, start.column, end.row, end.column);

      editor.selection.setRange(range);
      editor.renderer.scrollCursorIntoView(start);
      editor.focus();
    }
  }, []));

  // There's a tricky bug with Ace:
  //
  // 1. Open the page
  // 2. Fill up the page with text but do not cause scrolling
  // 3. Run the code (causing the pane to cover some of the text)
  // 4. Try to scroll
  //
  // Ace doesn't know that we changed the visible area and so
  // doesn't recalculate. We track factors that lead to this case to
  // force such a recalculation.
  useEditorProp(editor, props.resizeKey, useCallback((editor, _resizeKey) => {
    editor.resize();
  }, []));

  return (
    <div className={styles.ace} ref={child} />
  );
};

enum LoadState {
  Unloaded,
  Loading,
  Loaded,
}

// The ACE editor weighs in at ~250K. Adding all of the themes and the
// (surprisingly chunky) keybindings, it's not that far off from 500K!
//
// To give better initial load performance, we split the editor into a
// separate chunk. As you usually only want one of each theme and
// keybinding, they can also be split, reducing the total size
// transferred.
//
// This also has some benefit if you choose to use the simple editor,
// as ACE should never be loaded.
//
// Themes and keybindings can be changed at runtime.

interface AceEditorAsyncProps {
  autocompleteOnUse: boolean;
  code: string;
  execute: () => any;
  keybinding: string;
  onEditCode: (_: string) => any;
  position: Position;
  selection: Selection;
  theme: string;
  crates: Crate[];
  resizeKey?: AceResizeKey;
  pairCharacters: PairCharacters;
}

class AceEditorAsync extends React.Component<AceEditorAsyncProps, AceEditorAsyncState> {
  public constructor(props: AceEditorAsyncProps) {
    super(props);
    this.state = {
      modeState: LoadState.Unloaded,
      themeState: LoadState.Unloaded,
      keybindingState: LoadState.Unloaded,
    };
  }

  public render() {
    if (this.isLoaded()) {
      const { ace, theme, keybinding } = this.state;
      if (ace && theme && keybinding) {
        return <AceEditor {...this.props} ace={ace} theme={theme} keybinding={keybinding} />;
      } else {
        return <div>Internal error while loading the ACE editor</div>;
      }
    } else {
      return <div>Loading the ACE editor...</div>;
    }
  }

  public componentDidMount() {
    this.load();
  }

  public componentDidUpdate() {
    if (this.isLoadNeeded()) {
      this.load();
    }
  }

  private isLoaded() {
    const { modeState, themeState, keybindingState } = this.state;
    return modeState === LoadState.Loaded &&
      themeState === LoadState.Loaded &&
      keybindingState === LoadState.Loaded;
  }

  private isLoadNeeded() {
    return this.isAceLoadNeeded() ||
      this.isThemeLoadNeeded() ||
      this.isKeybindingLoadNeeded();
  }

  private async load() {
    return Promise.all([
      this.loadAce(),
      this.loadTheme(),
      this.loadKeybinding(),
    ]);
  }

  private isAceLoadNeeded() {
    const { ace, modeState } = this.state;
    return !ace && modeState !== LoadState.Loading;
  }

  private async loadAce() {
    if (!this.isAceLoadNeeded()) { return; }

    this.setState({ modeState: LoadState.Loading });

    const { default: { ace } } = await this.requireLibraries();

    this.setState({ ace, modeState: LoadState.Loaded });
  }

  private isKeybindingBuiltin() {
    return this.props.keybinding === 'ace';
  }

  private isKeybindingLoadNeeded() {
    const { keybinding, keybindingState } = this.state;
    return this.props.keybinding !== keybinding && keybindingState !== LoadState.Loading;
  }

  private async loadKeybinding() {
    const { keybinding } = this.props;

    if (this.isKeybindingBuiltin()) {
      this.setState({ keybinding, keybindingState: LoadState.Loaded });
      return;
    }

    if (!this.isKeybindingLoadNeeded()) { return; }

    this.setState({ keybindingState: LoadState.Loading });

    await this.requireLibraries();
    await import(
      /* webpackChunkName: "ace-[request]" */
      `ace-builds/src-noconflict/keybinding-${keybinding}`
    );

    this.setState({ keybinding, keybindingState: LoadState.Loaded });
  }

  private isThemeLoadNeeded() {
    const { theme, themeState } = this.state;
    return this.props.theme !== theme && themeState !== LoadState.Loading;
  }

  private async loadTheme() {
    if (!this.isThemeLoadNeeded()) { return; }

    const { theme } = this.props;

    this.setState({ themeState: LoadState.Loading });

    await this.requireLibraries();
    await import(
      /* webpackChunkName: "ace-[request]" */
      `ace-builds/src-noconflict/theme-${theme}`
    );

    this.setState({ theme, themeState: LoadState.Loaded });
  }

  private async requireLibraries() {
    return import(
      /* webpackChunkName: "ace-editor" */
      './ace-editor'
    );
  }
}

interface AceEditorAsyncState {
  theme?: string;
  keybinding?: string;
  themeState: LoadState;
  keybindingState: LoadState;
  modeState: LoadState;
  ace?: Ace;
  pairCharacters?: PairCharacters;
}

interface PropsFromState {
  theme: string;
  keybinding: string;
  resizeKey?: AceResizeKey;
  autocompleteOnUse: boolean;
  pairCharacters: PairCharacters;
}

const mapStateToProps = (state: State): PropsFromState => {
  const { configuration: { ace: { theme, keybinding, pairCharacters } } } = state;

  return {
    theme,
    pairCharacters,
    keybinding,
    resizeKey: aceResizeKey(state),
    autocompleteOnUse: offerCrateAutocompleteOnUse(state),
  };
};

export default connect(mapStateToProps)(AceEditorAsync);
