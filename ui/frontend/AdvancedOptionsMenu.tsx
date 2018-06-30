import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import { changeEdition } from './actions';
import { changeNightlyEdition } from './actions';
import { Either as EitherConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import { State } from './reducers';
import { getEditionSet, isEditionAvailable } from './selectors';
import { Edition } from './types';

interface AdvancedOptionsMenuProps {
  edition: Edition;
  isEditionSet: boolean;
  isEditionAvailable: boolean;
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
        isNotDefault={props.isEditionSet}
        onChange={props.changeEdition} />
      {!props.isEditionAvailable && <EditionAside />}
    </MenuGroup>
  </Fragment>
);

const EditionAside: React.SFC = () => (
  <p className="advanced-options-menu__aside">
    Note: Selecting an edition currently requires using the Nightly channel, selecting this
    option will switch to Nightly.
  </p>
);

const mapStateToProps = (state: State) => ({
  isEditionSet: getEditionSet(state),
  edition: state.configuration.edition,
  isEditionAvailable: isEditionAvailable(state),
});

const mapDispatchToProps = ({
  changeEdition: changeNightlyEdition,
});

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedOptionsMenu);
