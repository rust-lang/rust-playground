import React from 'react';
import PropTypes from 'prop-types';
import PureComponent from './PureComponent';
import { connect } from 'react-redux';

class AdvancedEditor extends PureComponent {
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
    // Auto-completing character literals interferes too much with
    // lifetimes, and there's no finer-grained control.
    this._editor.editor.setBehavioursEnabled(false);
    this._editor.editor.commands.addCommand({
      name: 'executeCode',
      bindKey: {
        win: 'Ctrl-Enter',
        mac: 'Ctrl-Enter|Command-Enter',
      },
      exec: this.props.execute,
      readOnly: true
    });
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

AdvancedEditor.propTypes = {
  ace: PropTypes.any.isRequired,
  AceEditor: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired,
  execute: PropTypes.func.isRequired,
  keybinding: PropTypes.string,
  onEditCode: PropTypes.func.isRequired,
  position: PropTypes.shape({
    line: PropTypes.number.isRequired,
    column: PropTypes.number.isRequired,
  }).isRequired,
  theme: PropTypes.string.isRequired,
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
class AdvancedEditorAsync extends React.Component {
  constructor(props) {
    super(props);
    this.state = { modeLoading: true };

    const loadAceEditor = import('react-ace');
    const loadAce = import('brace');

    Promise.all([loadAceEditor, loadAce])
      .then(([AceEditor, ace]) => {
        this.setState({ AceEditor: AceEditor.default, ace });

        this.load(props);
        import('brace/mode/rust')
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

const mapStateToProps = ({ configuration: { theme, keybinding } }) => ({
  theme,
  keybinding: keybinding === 'ace' ? null : keybinding,
});

export default connect(mapStateToProps)(AdvancedEditorAsync);
