import React from 'react';
import { connect } from 'react-redux';

import Playground from './Playground';
import Help from './Help';

const PageSwitcher: React.SFC<Props> = ({ page }) => (
  page === 'index' ? <Playground /> : <Help />
);

interface Props {
  page: string,
};

const mapStateToProps = ({ page }) => ({ page });

export default connect(mapStateToProps)(PageSwitcher);
