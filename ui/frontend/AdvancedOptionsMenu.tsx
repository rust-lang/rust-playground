import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import { changeBacktrace, changeEdition } from './actions';
import { Either as EitherConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import { State } from './reducers';
import { getBacktraceSet, getEditionSet } from './selectors';
import { Backtrace, Edition } from './types';

interface AdvancedOptionsMenuProps {
  edition: Edition;
  isEditionSet: boolean;
  changeEdition: (_: Edition) => any;
  backtrace: Backtrace;
  isBacktraceSet: boolean;
  changeBacktrace: (_: Backtrace) => any;
}

const AdvancedOptionsMenu: React.SFC<AdvancedOptionsMenuProps> = props => (
  <Fragment>
    <MenuGroup title="Advanced options">
      <EitherConfig
        id="edition"
        name="Edition"
        a={Edition.Rust2015}
        b={Edition.Rust2018}
        value={props.edition}
        isNotDefault={props.isEditionSet}
        onChange={props.changeEdition} />

      <EitherConfig
        id="backtrace"
        name="Backtrace"
        a={Backtrace.Disabled}
        b={Backtrace.Enabled}
        value={props.backtrace}
        isNotDefault={props.isBacktraceSet}
        onChange={props.changeBacktrace} />
    </MenuGroup>
  </Fragment>
);

const mapStateToProps = (state: State) => ({
  isEditionSet: getEditionSet(state),
  edition: state.configuration.edition,
  isBacktraceSet: getBacktraceSet(state),
  backtrace: state.configuration.backtrace,
});

const mapDispatchToProps = ({
  changeEdition,
  changeBacktrace,
});

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedOptionsMenu);
