import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Playground from './Playground';
import Help from './Help';

const PageSwitcher = ({ page }) => (
  page === 'index' ? <Playground /> : <Help />
);

PageSwitcher.propTypes = {
  page: PropTypes.string.isRequired,
};

const mapStateToProps = ({ page }) => ({ page });

export default connect(mapStateToProps)(PageSwitcher);
