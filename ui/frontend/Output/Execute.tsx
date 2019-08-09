import React from 'react';
import { connect } from 'react-redux';

import { addMainFunction } from '../actions';
import { State } from '../reducers';

import Section from './Section';
import SimplePane, { ReallySimplePaneProps } from './SimplePane';

interface ExecuteProps extends ReallySimplePaneProps {
  isAutoBuild: boolean;
  addMainFunction: () => any;
}

const Execute: React.SFC<ExecuteProps> = props => (
  <SimplePane {...props} kind="execute">
    {props.isAutoBuild && <Warning addMainFunction={props.addMainFunction} />}
  </SimplePane>
);

interface WarningProps {
  addMainFunction: () => any;
}

const Warning: React.SFC<WarningProps> = props => (
  <Section kind="warning" label="Warnings">
    No main function was detected, so your code was compiled
    {'\n'}
    but not run. If you’d like to execute your code, please
    {'\n'}
    <button className="output-add-main" onClick={props.addMainFunction}>
      add a main function
    </button>
    .
  </Section>
);

const mapStateToProps = (state: State) => state.output.execute;

const mapDispatchToProps = ({
  addMainFunction,
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Execute);
