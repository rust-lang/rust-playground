import React from 'react';
import { connect } from 'react-redux';

import { Focus } from './reducers/output/meta';
import State from './state';
import { CommonEditorProps } from './types';

const displayExternCrateAutocomplete = editor => {
  const { session } = editor;
  const pos = editor.getCursorPosition();
  const line = session.getLine(pos.row);
  const precedingText = line.slice(0, pos.column);

  return !!precedingText.match(/extern\s+crate\s*(\w+)?$/);
};

function buildCrateAutocompleter(component) {
  function getCompletions(editor, session, pos, prefix, callback) {
    let suggestions = [];

    if (displayExternCrateAutocomplete(editor)) {
      const { crates } = component.props;
      const len = crates.length;

      suggestions = crates.map(({ name, version, id }, i) => ({
        caption: `${name} (${version})`,
        value: id,
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

    // Auto-completing character literals interferes too much with
    // lifetimes, and there's no finer-grained control.
    editor.setBehavioursEnabled(false);
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

    // When the user types `extern crate` and a space, automatically
    // open the autocomplete. This should help people understand that
    // there are crates available.
    editor.commands.on('afterExec', event => {
      const { editor, command } = event;

      if (!(command.name === 'backspace' || command.name === 'insertstring')) {
        return;
      }

      if (displayExternCrateAutocomplete(editor)) {
        editor.execCommand('startAutocomplete');
      }
    });

    editor.completers = [buildCrateAutocompleter(this)];
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
  code: string;
  execute: () => any;
  keybinding?: string;
  onEditCode: (_: string) => any;
  position: {
    line: number,
    column: number,
  };
  theme: string;
  crates: Array<{
    id: string,
    name: string,
    version: string,
  }>;
  focus?: Focus;
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
    this.state = { modeLoading: true };

    this.requireLibraries()
      .then(({ default: { AceEditor, ace } }) => {
        this.load(props);
        this.setState({ AceEditor, ace, modeLoading: false });
      });
  }

  public render() {
    if (this.isLoading()) {
      return <div>Loading the ACE editor...</div>;
    } else {
      const { ace, AceEditor } = this.state;
      return <AdvancedEditor {...this.props} AceEditor={AceEditor} ace={ace} />;
    }
  }

  public componentWillReceiveProps(nextProps) {
    this.load(nextProps);
  }

  private isLoading() {
    return this.state.themeLoading ||
      this.state.keybindingLoading ||
      this.state.modeLoading ||
      this.state.AceEditor === null;
  }

  private load(props) {
    const { keybinding, theme } = props;
    this.loadTheme(theme);
    this.loadKeybinding(keybinding);
  }

  private loadKeybinding(keybinding) {
    if (keybinding && keybinding !== this.state.keybinding) {
      this.setState({ keybindingLoading: true });

      this.requireLibraries()
        .then(() => import(
          /* webpackChunkName: "brace-keybinding-[request]" */
          `brace/keybinding/${keybinding}`,
        ))
        .then(() => this.setState({ keybinding, keybindingLoading: false }));
    }
  }

  private loadTheme(theme) {
    if (theme !== this.state.theme) {
      this.setState({ themeLoading: true });

      this.requireLibraries()
        .then(() => import(
          /* webpackChunkName: "brace-theme-[request]" */
          `brace/theme/${theme}`,
        ))
        .then(() => this.setState({ theme, themeLoading: false }));
    }
  }

  private requireLibraries() {
    return import(
      /* webpackChunkName: "advanced-editor" */
      './advanced-editor',
    );
  }
}

interface AdvancedEditorAsyncState {
  theme?: string;
  keybinding?: string;
  themeLoading?: boolean;
  keybindingLoading?: boolean;
  modeLoading: boolean;
  AceEditor?: React.ReactType;
  ace?: any;
}

interface PropsFromState {
  theme: string;
  keybinding?: string;
  focus?: Focus;
}

const mapStateToProps = (state: State) => {
  const { configuration: { theme, keybinding } } = state;

  return {
    theme,
    keybinding: keybinding === 'ace' ? null : keybinding,
    focus: state.output.meta.focus,
  };
};

export default connect<PropsFromState, undefined, CommonEditorProps>(mapStateToProps)(AdvancedEditorAsync);
