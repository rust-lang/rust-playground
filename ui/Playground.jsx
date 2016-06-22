import React, { PropTypes } from 'react';
import { performBuild, editCode } from './actions';
import { connect } from 'react-redux';
import Header from './Header.jsx';
import Editor from './Editor.jsx';
import Output from './Output.jsx';

class Playground extends React.Component {
  render() {
    const { code, status: { stdout, stderr }, onBuildClick, onEditCode } = this.props;

    return (
      <div>
        <Header onBuildClick={onBuildClick} />
        <Editor code={code} onEditCode={onEditCode} />
        <Output stdout={stdout} stderr={stderr} />
      </div>
    );
  }
};

Playground.propTypes = {
  onBuildClick: PropTypes.func.isRequired,
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired,
  status: PropTypes.object.isRequired
};

const mapStateToProps = (state) => {
  return {
    code: state.code,
    status: state.status
  };
}

const mapDispatchToProps = (dispatch) => {
  return {
    onBuildClick: () => {
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
