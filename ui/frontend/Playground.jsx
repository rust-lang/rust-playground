import React, { PropTypes } from 'react';
import {
  changeEditor, changeChannel, changeMode,
  performExecute, performCompileToAssembly, performCompileToLLVM,
  performFormat, performSaveToGist,
  editCode, toggleConfiguration
} from './actions';
import { connect } from 'react-redux';

import Configuration from './Configuration.jsx';
import Header from './Header.jsx';
import Editor from './Editor.jsx';
import Output from './Output.jsx';

class Playground extends React.Component {
  render() {
    const { code,
            status: { code: compiledCode, stdout, stderr, error, gist },
            execute, compileToAssembly, compileToLLVM, format, saveToGist,
            configuration: { channel, mode, tests, editor, shown: showConfig },
            changeChannel, changeMode, onEditCode, changeEditor,
            toggleConfiguration
          } = this.props;

    const config = showConfig ? this.renderConfiguration() : null;

    return (
      <div>
        { config }
        <Header execute={execute}
                compileToAssembly={compileToAssembly}
                compileToLLVM={compileToLLVM}
                format={format} saveToGist={saveToGist}
                channel={channel} changeChannel={changeChannel}
                mode={mode} changeMode={changeMode}
                tests={tests} toggleConfiguration={toggleConfiguration} />
        <Editor editor={editor} code={code} onEditCode={onEditCode} />
        <Output code={compiledCode} stdout={stdout} stderr={stderr} error={error} gist={gist} />
      </div>
    );
  }

  renderConfiguration() {
    const { configuration: { editor }, changeEditor, toggleConfiguration } = this.props;

    return (
      <div className="modal-backdrop">
        <div className="modal-content">
          <Configuration editor={editor}
                         changeEditor={changeEditor}
                         toggleConfiguration={toggleConfiguration} />
        </div>
      </div>
    );
  }
};

Playground.propTypes = {
  execute: PropTypes.func.isRequired,
  compileToAssembly: PropTypes.func.isRequired,
  compileToLLVM: PropTypes.func.isRequired,
  format: PropTypes.func.isRequired,
  saveToGist: PropTypes.func.isRequired,
  configuration: PropTypes.object.isRequired,
  changeChannel: PropTypes.func.isRequired,
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired,
  status: PropTypes.object.isRequired
};

const mapStateToProps = (state) => {
  return {
    configuration: state.configuration,
    code: state.code,
    status: state.status
  };
}

const mapDispatchToProps = (dispatch) => {
  return {
    toggleConfiguration: () => dispatch(toggleConfiguration()),
    changeEditor: (editor) => dispatch(changeEditor(editor)),
    changeChannel: (channel) => dispatch(changeChannel(channel)),
    changeMode: (mode) => dispatch(changeMode(mode)),
    execute: () => dispatch(performExecute()),
    compileToAssembly: () => dispatch(performCompileToAssembly()),
    compileToLLVM: () => dispatch(performCompileToLLVM()),
    format: () => dispatch(performFormat()),
    saveToGist: () => dispatch(performSaveToGist()),
    onEditCode: (code) => dispatch(editCode(code))
  };
};

const ConnectedPlayground = connect(
  mapStateToProps,
  mapDispatchToProps
)(Playground);

export default ConnectedPlayground;
