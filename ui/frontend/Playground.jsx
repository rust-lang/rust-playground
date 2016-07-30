import React, { PropTypes } from 'react';
import {
  changeEditor, changeTheme,
  editCode, toggleConfiguration,
  changeFocus
} from './actions';
import { connect } from 'react-redux';

import Configuration from './Configuration';
import Header from './Header';
import Editor from './Editor';
import Output from './Output';

function ConfigurationModal(props) {
  const {
    editor, changeEditor,
    theme, changeTheme,
    toggleConfiguration
  } = props;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <Configuration editor={editor} changeEditor={changeEditor}
                       theme={theme} changeTheme={changeTheme}
                       toggleConfiguration={toggleConfiguration} />
      </div>
    </div>
  );
}

class Playground extends React.Component {
  render() {
    const { code, position,
            configuration: { editor, theme, shown: showConfig },
            onEditCode, changeEditor, changeTheme,
            toggleConfiguration,
            output, changeFocus
          } = this.props;

    const config = showConfig ? <ConfigurationModal editor={editor} changeEditor={changeEditor} theme={theme} changeTheme={changeTheme} toggleConfiguration={toggleConfiguration} /> : null;

    const outputFocused = output.meta.focus ? 'playground-output-focused' : '';

    return (
      <div>
        { config }
        <div className="playground">
          <div className="playground-header">
            <Header />
          </div>
          <div className="playground-editor">
            <Editor editor={editor} theme={theme} code={code} position={position} onEditCode={onEditCode} />
          </div>
          <div className={`playground-output ${outputFocused}`}>
            <Output output={output} changeFocus={changeFocus} />
          </div>
        </div>
      </div>
    );
  }

  componentDidUpdate(prevProps, _prevState) {
    if (this.props.output.meta.focus !== prevProps.output.meta.focus) {
      // Inform the ACE editor that its size has changed.
      try {
        window.dispatchEvent(new Event('resize'));
      } catch (ex) {
        // IE 11
        const evt = window.document.createEvent('UIEvents');
        evt.initUIEvent('resize', true, false, window, 0);
        window.dispatchEvent(evt);
      }
    }
  }
}

Playground.propTypes = {
  configuration: PropTypes.object.isRequired,
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired
};

const mapStateToProps = (state) => {
  const { configuration, code, position, output } = state;
  return { configuration, code, position, output };
};

const mapDispatchToProps = (dispatch) => {
  return {
    changeEditor: (editor) => dispatch(changeEditor(editor)),
    changeTheme: (theme) => dispatch(changeTheme(theme)),
    changeFocus: (outputPane) => dispatch(changeFocus(outputPane)),
    onEditCode: (code) => dispatch(editCode(code)),
    toggleConfiguration: () => dispatch(toggleConfiguration()),
  };
};

const ConnectedPlayground = connect(
  mapStateToProps,
  mapDispatchToProps
)(Playground);

export default ConnectedPlayground;
