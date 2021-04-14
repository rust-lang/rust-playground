import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Split from 'react-split-grid';

import Editor from './Editor';
import Header from './Header';
import Notifications from './Notifications';
import Output from './Output';
import * as selectors from './selectors';
import { Orientation } from './types';
import * as actions from './actions';

import styles from './Playground.module.css';

const NoOutput: React.SFC = () => (
  <div className={styles.editor}><Editor /></div>
);

const PlainRows: React.SFC = () => (
  <div className={styles.plainRows}>
    <div className={styles.editor}><Editor /></div>
    <div className={styles.output}><Output /></div>
  </div>
);

const PlainColumns: React.SFC = () => (
  <div className={styles.plainColumns}>
    <div className={styles.editor}><Editor /></div>
    <div className={styles.output}><Output /></div>
  </div>
);

interface SplitProps {
  resizeComplete: () => void;
}

const SplitRows: React.SFC<SplitProps> = ({ resizeComplete }) => (
  <Split
    minSize={100}
    onDragEnd={resizeComplete}
    render={({
      getGridProps,
      getGutterProps,
    }) => (
      <div className={styles.splitRows} {...getGridProps()}>
        <div className={styles.editor}><Editor /></div>
        <div className={styles.splitRowsGutter} {...getGutterProps('row', 1)}>
          <span className={styles.splitRowsGutterHandle}>⣿</span>
        </div>
        <div className={styles.output}><Output /></div>
      </div>
    )} />
)

const SplitColumns: React.SFC<SplitProps> = ({ resizeComplete }) => (
  <Split
    minSize={100}
    onDragEnd={resizeComplete}
    render={({
      getGridProps,
      getGutterProps,
    }) => (
      <div className={styles.splitColumns} {...getGridProps()}>
        <div className={styles.editor}><Editor /></div>
        <div className={styles.splitColumnsGutter} {...getGutterProps('column', 1)}>⣿</div>
        <div className={styles.output}><Output /></div>
      </div>
    )} />
)

const ORIENTATION_PLAIN_MAP = {
  [Orientation.Horizontal]: PlainRows,
  [Orientation.Vertical]: PlainColumns,
}

const ORIENTATION_SPLIT_MAP = {
  [Orientation.Horizontal]: SplitRows,
  [Orientation.Vertical]: SplitColumns,
}

const Playground: React.SFC = () => {
  const showNotifications = useSelector(selectors.anyNotificationsToShowSelector);
  const somethingToShow = useSelector(selectors.getSomethingToShow);
  const isFocused = useSelector(selectors.isOutputFocused);
  const orientation = useSelector(selectors.orientation);

  const dispatch = useDispatch();
  const resizeComplete = useCallback(() => dispatch(actions.splitRatioChanged()), [dispatch]);

  let Foo;
  if (!somethingToShow) {
    Foo = NoOutput;
  } else {
    if (isFocused) {
      Foo = ORIENTATION_SPLIT_MAP[orientation];
    } else {
      Foo = ORIENTATION_PLAIN_MAP[orientation];
    }
  }

  return (
    <>
      <div className={styles.container}>
        <div>
          <Header />
        </div>
        <Foo resizeComplete={resizeComplete} />
      </div>
      { showNotifications && <Notifications />}
    </>
  );
};

export default Playground;
