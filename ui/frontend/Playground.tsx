import React, { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Split from 'split-grid';

import Editor from './Editor';
import Header from './Header';
import Notifications from './Notifications';
import Output from './Output';
import * as selectors from './selectors';
import { Orientation } from './types';
import * as actions from './actions';

import styles from './Playground.module.css';

const TRACK_OPTION_NAME = {
  [Orientation.Horizontal]: 'rowGutters',
  [Orientation.Vertical]: 'columnGutters',
}

const FOCUSED_GRID_STYLE = {
  [Orientation.Horizontal]: styles.resizeableAreaRowOutputFocused,
  [Orientation.Vertical]: styles.resizeableAreaColumnOutputFocused,
}

const UNFOCUSED_GRID_STYLE = {
  [Orientation.Horizontal]: styles.resizeableAreaRowOutputUnfocused,
  [Orientation.Vertical]: styles.resizeableAreaColumnOutputUnfocused,
}

const HANDLE_STYLES = {
  [Orientation.Horizontal]: [styles.splitRowsGutter, styles.splitRowsGutterHandle],
  [Orientation.Vertical]: [styles.splitColumnsGutter, ''],
}

// We drop down to lower-level split-grid code and use some hooks
// because we want to reduce the number of times that the Editor
// component is remounted. Each time it's remounted, we see a flicker and
// lose state (like undo history).
const ResizableArea: React.SFC = () => {
  const somethingToShow = useSelector(selectors.getSomethingToShow);
  const isFocused = useSelector(selectors.isOutputFocused);
  const orientation = useSelector(selectors.orientation);

  const dispatch = useDispatch();
  const resizeComplete = useCallback(() => dispatch(actions.splitRatioChanged()), [dispatch]);

  const grid = useRef(null);
  const dragHandle = useRef(null);

  // Reset styles left on the grid from split-grid when we change orientation or focus.
  useEffect(() => {
    grid.current.style['grid-template-columns'] = null;
    grid.current.style['grid-template-rows'] = null;

    resizeComplete();
  }, [orientation, isFocused, resizeComplete])

  useEffect(() => {
    const split = Split({
      minSize: 100,
      [TRACK_OPTION_NAME[orientation]]: [{
        track: 1,
        element: dragHandle.current,
      }],
      onDragEnd: resizeComplete,
    });

    return () => split.destroy();
  }, [orientation, isFocused, somethingToShow, resizeComplete])

  const gridStyles = isFocused ? FOCUSED_GRID_STYLE : UNFOCUSED_GRID_STYLE;
  const gridStyle = gridStyles[orientation];
  const [handleOuterStyle, handleInnerStyle] = HANDLE_STYLES[orientation];

  return (
    <div ref={grid} className={gridStyle}>
      <div className={styles.editor}><Editor /></div>
      { isFocused &&
        <div ref={dragHandle} className={handleOuterStyle}>
          <span className={handleInnerStyle}>⣿</span>
        </div>
      }
      { somethingToShow && <div className={styles.output}><Output /></div>}
    </div>
  );
};

const Playground: React.SFC = () => {
  const showNotifications = useSelector(selectors.anyNotificationsToShowSelector);

  return (
    <>
      <div className={styles.container}>
        <Header />
        <ResizableArea />
      </div>
      { showNotifications && <Notifications />}
    </>
  );
}

export default Playground;
