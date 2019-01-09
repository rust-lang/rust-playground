import React from 'react';
import { connect } from 'react-redux';

import State from './state';
import { CommonEditorProps, Crate, Edition, Focus } from './types';

const displayExternCrateAutocomplete = (editor: any, autocompleteOnUse: boolean) => {
  const { session } = editor;
  const pos = editor.getCursorPosition();
  const line = session.getLine(pos.row);
  const precedingText = line.slice(0, pos.column);

  return !!precedingText.match(/^\s*extern\s+crate\s*\w*$/) ||
    (autocompleteOnUse && !!precedingText.match(/^\s*use\s+(?!crate|self|super)\w*$/));
};

interface AutocompleteData {
  crates: Crate[];
  autocompleteOnUse: boolean;
}

function buildCrateAutocompleter(dataSource: () => AutocompleteData) {
  function getCompletions(editor, session, pos, prefix, callback) {
    const { crates, autocompleteOnUse } = dataSource();
    let suggestions = [];

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
  }

  return {
    getCompletions,
  };
}

class AdvancedEditor extends React.PureComponent<AdvancedEditorProps> {
  private _editor: any;
  private trackEditor = component => this._editor = component;

  public render() {
    const { ace, AceEditor, keybinding, theme, code, onEditCode } = this.props;

    if (keybinding === 'vim') {
      const { CodeMirror: { Vim } } = ace.acequire('ace/keyboard/vim');
      Vim.defineEx('write', 'w', (cm, _input) => {
        cm.ace.execCommand('executeCode');
      });
    }

    return (
      <AceEditor
        ref={this.trackEditor}
        mode="rust-playground"
        keyboardHandler={keybinding}
        theme={theme}
        value={code}
        onChange={onEditCode}
        name="editor"
        width="100%"
        height="100%"
        editorProps={{ $blockScrolling: true }} />
    );
  }

  public componentDidMount() {
    const { _editor: { editor } } = this;

    editor.commands.addCommand({
      name: 'executeCode',
      bindKey: {
        win: 'Ctrl-Enter',
        mac: 'Ctrl-Enter|Command-Enter',
      },
      exec: this.props.execute,
      readOnly: true,
    });

    // The default keybinding of control/command-l interferes with
    // the browser's "edit the location" keycommand which I think
    // is way more common.
    const gotoCommand = editor.commands.byName.gotoline;
    gotoCommand.bindKey = {
      win: 'Ctrl-Shift-L',
      mac: 'Command-Shift-L',
    };
    editor.commands.removeCommand(gotoCommand.name);
    editor.commands.addCommand(gotoCommand);

    editor.setOptions({
      enableBasicAutocompletion: true,
    });

    // When the user types either `extern crate `  or `use `, automatically
    // open the autocomplete. This should help people understand that
    // there are crates available.
    editor.commands.on('afterExec', event => {
      const { editor, command } = event;

      if (!(command.name === 'backspace' || command.name === 'insertstring')) {
        return;
      }

      if (displayExternCrateAutocomplete(editor, this.props.autocompleteOnUse)) {
        editor.execCommand('startAutocomplete');
      }
    });

    editor.completers = [buildCrateAutocompleter(() => this.props)];
  }

  public componentDidUpdate(prevProps, _prevState) {
    // There's a tricky bug with Ace:
    //
    // 1. Open the page
    // 2. Fill up the page with text but do not cause scrolling
    // 3. Run the code (causing the pane to cover some of the text
    // 4. Try to scroll
    //
    // Ace doesn't know that we changed the visible area and so
    // doesn't recalculate. Knowing if the focus changed is enough
    // to force such a recalculation.
    if (this.props.focus !== prevProps.focus) {
      this._editor.editor.resize();
    }
    this.gotoPosition(prevProps.position, this.props.position);
  }

  private gotoPosition(oldPosition, newPosition) {
    const editor = this._editor;

    if (!newPosition || !editor) { return; }
    if (newPosition === oldPosition) { return; }

    const { line, column } = newPosition;

    // Columns are zero-indexed in ACE
    editor.editor.gotoLine(line, column - 1);
    editor.editor.focus();
  }
}

interface AdvancedEditorProps {
  ace: any;
  AceEditor: React.ReactType;
  autocompleteOnUse: boolean;
  code: string;
  execute: () => any;
  keybinding?: string;
  onEditCode: (_: string) => any;
  position: {
    line: number,
    column: number,
  };
  theme: string;
  crates: Crate[];
  focus?: Focus;
}

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
class AdvancedEditorAsync extends React.Component<AdvancedEditorProps, AdvancedEditorAsyncState> {
  constructor(props) {
    super(props);
    this.state = {
      modeState: LoadState.Unloaded,
      themeState: LoadState.Unloaded,
      keybindingState: LoadState.Unloaded,
    };
  }

  public render() {
    if (this.isLoaded()) {
      const { ace, AceEditor, theme, keybinding } = this.state;
      return <AdvancedEditor {...this.props} AceEditor={AceEditor} ace={ace} theme={theme} keybinding={keybinding} />;
    } else {
      return <div>Loading the ACE editor...</div>;
    }
  }

  public componentDidMount() {
    this.load();
  }

  public componentDidUpdate(prevProps, prevState) {
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
    const { AceEditor, modeState } = this.state;
    return !AceEditor && modeState !== LoadState.Loading;
  }

  private async loadAce() {
    if (!this.isAceLoadNeeded()) { return; }

    this.setState({ modeState: LoadState.Loading });

    const { default: { AceEditor, ace } } = await this.requireLibraries();

    this.setState({ AceEditor, ace, modeState: LoadState.Loaded });
  }

  private isKeybindingBuiltin() {
    return this.props.keybinding === null;
  }

  private isKeybindingLoadNeeded() {
    const { keybinding, keybindingState } = this.state;
    return this.props.keybinding !== keybinding && keybindingState !== LoadState.Loading;
  }

  private async loadKeybinding() {
    if (!this.isKeybindingLoadNeeded()) { return; }

    const { keybinding } = this.props;

    if (this.isKeybindingBuiltin()) {
      this.setState({ keybinding, keybindingState: LoadState.Loaded });
      return;
    }

    this.setState({ keybindingState: LoadState.Loading });

    await this.requireLibraries();
    await import(
      /* webpackChunkName: "brace-keybinding-[request]" */
      `brace/keybinding/${keybinding}`,
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
      /* webpackChunkName: "brace-theme-[request]" */
      `brace/theme/${theme}`,
    );

    this.setState({ theme, themeState: LoadState.Loaded });
  }

  private async requireLibraries() {
    return import(
      /* webpackChunkName: "advanced-editor" */
      './advanced-editor',
    );
  }
}

interface AdvancedEditorAsyncState {
  theme?: string;
  keybinding?: string;
  themeState: LoadState;
  keybindingState: LoadState;
  modeState: LoadState;
  AceEditor?: React.ReactType;
  ace?: any;
}

interface PropsFromState {
  theme: string;
  keybinding?: string;
  focus?: Focus;
  autocompleteOnUse: boolean;
}

const mapStateToProps = (state: State) => {
  const { configuration: { theme, keybinding } } = state;

  return {
    theme,
    keybinding: keybinding === 'ace' ? null : keybinding,
    focus: state.output.meta.focus,
    autocompleteOnUse: state.configuration.edition === Edition.Rust2018,
  };
};

export default connect<PropsFromState, undefined, CommonEditorProps>(mapStateToProps)(AdvancedEditorAsync);
