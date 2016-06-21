import React, { PropTypes } from 'react';
import { performBuild, editCode } from './actions';
import { connect } from 'react-redux';

class Header extends React.Component {
  render() {
    const { code, onBuildClick, onEditCode } = this.props;

    return (
      <div>
        <button onClick={ onBuildClick }>Build</button>
        <textarea value={ code } onChange={ (e) => onEditCode(e.target.value) } />
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
    },
    onEditCode: (code) => {
      dispatch(editCode(code));
    }
  };
};

const ConnectedHeader = connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);

export default ConnectedHeader;
