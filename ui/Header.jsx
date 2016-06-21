import React, { PropTypes } from 'react';
import { performBuild } from './actions';
import { connect } from 'react-redux';

class Header extends React.Component {
  render() {
    const { code, onBuildClick } = this.props;

    return (
      <div>
        <button onClick={ onBuildClick }>Build</button>
        <textarea value={ code } />
      </div>
    );
  }
};

Header.propTypes = {
  // onClick: PropTypes.func.isRequired,
  // completed: PropTypes.bool.isRequired,
  code: PropTypes.string.isRequired
};

Header.defaultProps = {
  code: ""
};

const mapStateToProps = (state) => {
  return {
    code: state.code
  };
}

const mapDispatchToProps = (dispatch) => {
  return {
    onBuildClick: () => {
      dispatch(performBuild());
    }
  };
};

const ConnectedHeader = connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);

export default ConnectedHeader;
