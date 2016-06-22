import React, { PropTypes } from 'react';
import { changeChannel, performBuild, editCode } from './actions';
import { connect } from 'react-redux';
import Header from './Header.jsx';
import Editor from './Editor.jsx';
import Output from './Output.jsx';

class Playground extends React.Component {
  render() {
    const { code, status: { stdout, stderr }, build, configuration: { channel }, changeChannel, onEditCode } = this.props;

    return (
      <div>
        <Header build={build} channel={channel} changeChannel={changeChannel} />
        <Editor code={code} onEditCode={onEditCode} />
        <Output stdout={stdout} stderr={stderr} />
      </div>
    );
  }
};

Playground.propTypes = {
  build: PropTypes.func.isRequired,
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
    build: () => {
      dispatch(performBuild());
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
