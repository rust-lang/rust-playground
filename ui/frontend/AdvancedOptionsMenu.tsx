import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import { changeEdition } from './actions';
import { Either as EitherConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import { State } from './reducers';
import { Edition } from './types';

interface AdvancedOptionsMenuProps {
  edition: Edition;
  changeEdition: (_: Edition) => any;
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
        onChange={props.changeEdition} />
    </MenuGroup>
  </Fragment>
);

const mapStateToProps = (state: State) => ({
  edition: state.configuration.edition,
});

const mapDispatchToProps = ({
  changeEdition,
});

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedOptionsMenu);
