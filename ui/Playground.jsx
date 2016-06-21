import React, { PropTypes } from 'react';
import { performBuild, editCode } from './actions';
import { connect } from 'react-redux';
import Header from './Header.jsx';
import Editor from './Editor.jsx';
import Output from './Output.jsx';

class Playground extends React.Component {
  render() {
    const { code, output, onBuildClick, onEditCode } = this.props;

    return (
      <div>
        <Header onBuildClick={onBuildClick} />
        <Editor code={code} onEditCode={onEditCode} />
        <Output output={output} />
      </div>
    );
  }
};

Playground.propTypes = {
  onBuildClick: PropTypes.func.isRequired,
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired,
  output: PropTypes.string.isRequired
};

const mapStateToProps = (state) => {
  return {
    code: state.code,
    output: state.output
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
