import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as actions from '../actions';
import * as selectors from '../selectors';
import { State } from '../reducers';

import Section from './Section';
import SimplePane from './SimplePane';

import styles from './Execute.module.css';

const Execute: React.FC = () => {
  const details = useSelector((state: State) => state.output.execute);
  const isAutoBuild = useSelector(selectors.isAutoBuildSelector);

  const dispatch = useDispatch();
  const addMainFunction = useCallback(() => dispatch(actions.addMainFunction()), [dispatch]);

  return (
    <SimplePane {...details} kind="execute">
      {isAutoBuild && <Warning addMainFunction={addMainFunction} />}
    </SimplePane>

  );
};

interface WarningProps {
  addMainFunction: () => any;
}

const Warning: React.FC<WarningProps> = props => (
  <Section kind="warning" label="Warnings">
    No main function was detected, so your code was compiled
    {'\n'}
    but not run. If you’d like to execute your code, please
    {'\n'}
    <button className={styles.addMain} onClick={props.addMainFunction}>
      add a main function
    </button>
    .
  </Section>
);

export default Execute;
