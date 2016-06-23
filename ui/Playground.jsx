import React, { PropTypes } from 'react';
import { changeChannel, changeMode, performBuild, performFormat, editCode } from './actions';
import { connect } from 'react-redux';
import Header from './Header.jsx';
import Editor from './Editor.jsx';
import Output from './Output.jsx';

class Playground extends React.Component {
  render() {
    const { code,
            status: { stdout, stderr },
            build, format,
            configuration: { channel, mode, tests },
            changeChannel, changeMode, onEditCode
          } = this.props;

    return (
      <div>
        <Header build={build} format={format}
                channel={channel} changeChannel={changeChannel}
                mode={mode} changeMode={changeMode}
                tests={tests} />
        <Editor code={code} onEditCode={onEditCode} />
        <Output stdout={stdout} stderr={stderr} />
      </div>
    );
  }
};

Playground.propTypes = {
  build: PropTypes.func.isRequired,
  format: PropTypes.func.isRequired,
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
    changeChannel: (channel) => {
      dispatch(changeChannel(channel));
    },
    changeMode: (mode) => {
      dispatch(changeMode(mode));
    },
    build: () => {
      dispatch(performBuild());
    },
    format: () => {
      dispatch(performFormat());
    },
    onEditCode: (code) => {
      dispatch(editCode(code));
    }
  };
};

const ConnectedPlayground = connect(
  mapStateToProps,
  mapDispatchToProps
)(Playground);

export default ConnectedPlayground;
