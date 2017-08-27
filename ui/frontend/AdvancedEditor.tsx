import React from 'react';
import { connect } from 'react-redux';

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
  trackEditor = component => this._editor = component;

  render() {
    const { ace, AceEditor, keybinding, theme, code, onEditCode } = this.props;

    if (keybinding === 'vim') {
      const { CodeMirror: { Vim } } = ace.acequire('ace/keyboard/vim');
      Vim.defineEx("write", "w", (cm, _input) => {
        cm.ace.execCommand("executeCode");
      });
    }

    return (
      <AceEditor
         ref={this.trackEditor}
         mode="rust"
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

  componentDidMount() {
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
      readOnly: true
    });

    editor.setOptions({
      enableBasicAutocompletion: true,
    });

    // When the user types `extern crate` and a space, automatically
    // open the autocomplete. This should help people understand that
    // there are crates available.
    editor.commands.on('afterExec', event => {
      const { editor, command } = event;

      if (!(command.name === "backspace" || command.name === "insertstring")) {
        return;
      }

      if (displayExternCrateAutocomplete(editor)) {
        editor.execCommand('startAutocomplete');
      }
    });

    editor.completers = [buildCrateAutocompleter(this)];
  }

  componentDidUpdate(prevProps, _prevState) {
    this.gotoPosition(prevProps.position, this.props.position);
  }

  gotoPosition(oldPosition, newPosition) {
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
  ace: any,
  AceEditor: React.ReactType,
  code: string,
  execute: () => any,
  keybinding?: string,
  onEditCode: (string) => any,
  position: {
    line: number,
    column: number,
  },
  theme: string,
  crates: {
    id: string,
    name: string,
    version: string,
  }[],
};

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
// There's some implicit ordering; the library must be loaded before
// any other piece. Themes and keybindings can also be changed at
// runtime.
class AdvancedEditorAsync extends React.Component<AdvancedEditorProps, AdvancedEditorAsyncState> {
  constructor(props) {
    super(props);
    this.state = { modeLoading: true };

    const loadAceEditor = import('react-ace');
    const loadAce = import('brace');

    Promise.all([loadAceEditor, loadAce])
      .then(([AceEditor, ace]) => {
        this.setState({ AceEditor: AceEditor.default, ace });

        this.load(props);
        const loadRustMode = import('brace/mode/rust');
        const loadLanguageTools = import('brace/ext/language_tools');
        Promise.all([loadRustMode, loadLanguageTools])
          .then(() => this.setState({ modeLoading: false }));
      });
  }

  render() {
    if (this.isLoading()) {
      return <div>Loading the ACE editor...</div>;
    } else {
      const { ace, AceEditor } = this.state;
      return <AdvancedEditor {...this.props} AceEditor={AceEditor} ace={ace} />;
    }
  }

  componentWillReceiveProps(nextProps) {
    this.load(nextProps);
  }

  isLoading() {
    return this.state.themeLoading ||
      this.state.keybindingLoading ||
      this.state.modeLoading ||
      this.state.AceEditor === null;
  }

  load(props) {
    const { keybinding, theme } = props;
    this.loadTheme(theme);
    this.loadKeybinding(keybinding);
  }

  loadKeybinding(keybinding) {
    if (keybinding && keybinding !== this.state.keybinding) {
      this.setState({ keybindingLoading: true });
      import('brace')
        .then(() => import(`brace/keybinding/${keybinding}`))
        .then(() => this.setState({ keybinding, keybindingLoading: false }));
    }
  }

  loadTheme(theme) {
    if (theme !== this.state.theme) {
      this.setState({ themeLoading: true });

      import('brace')
        .then(() => import(`brace/theme/${theme}`))
        .then(() => this.setState({ theme, themeLoading: false }));
    }
  }
}

interface AdvancedEditorAsyncState {
  theme?: string,
  keybinding?: string,
  themeLoading?: boolean,
  keybindingLoading?: boolean,
  modeLoading: boolean,
  AceEditor?: React.ReactType,
  ace?: any,
};

interface PropsFromState {
  theme: string,
  keybinding?: string,
};

const mapStateToProps = ({ configuration: { theme, keybinding } }: State) => ({
  theme,
  keybinding: keybinding === 'ace' ? null : keybinding,
});

export default connect<PropsFromState, undefined, CommonEditorProps>(mapStateToProps)(AdvancedEditorAsync);
