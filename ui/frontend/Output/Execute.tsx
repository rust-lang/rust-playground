import React from 'react';
import { connect } from 'react-redux';

import { State } from '../reducers';
import SimplePane, { SimplePaneProps } from './SimplePane';

const Execute: React.SFC<SimplePaneProps> = execute => (
  <SimplePane {...execute} kind="execute" />
);

const mapStateToProps = (state: State) => (
  state.output.execute
);

export default connect(
  mapStateToProps,
)(Execute);
