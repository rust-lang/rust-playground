import React, { useEffect, useRef } from 'react';
import Split from 'split-grid';

import Editor from './editor/Editor';
import Header from './Header';
import Notifications from './Notifications';
import Output from './Output';
import * as selectors from './selectors';
import { Orientation } from './types';
import { useAppSelector } from './hooks';

import * as styles from './Playground.module.css';

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
const ResizableArea: React.FC = () => {
  const somethingToShow = useAppSelector(selectors.getSomethingToShow);
  const isFocused = useAppSelector(selectors.isOutputFocused);
  const orientation = useAppSelector(selectors.orientation);

  const grid = useRef<HTMLDivElement | null>(null);
  const dragHandle = useRef(null);

  // Reset styles left on the grid from split-grid when we change orientation or focus.
  useEffect(() => {
    if (grid.current) {
      grid.current.style.removeProperty('grid-template-columns');
      grid.current.style.removeProperty('grid-template-rows');
    }
  }, [orientation, isFocused])

  useEffect(() => {
    const split = Split({
      minSize: 100,
      [TRACK_OPTION_NAME[orientation]]: [{
        track: 1,
        element: dragHandle.current,
      }],
    });

    return () => split.destroy();
  }, [orientation, isFocused, somethingToShow])

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


const WebSocketStatus: React.FC = () => {
  const enabled = useAppSelector(selectors.showGemSelector);
  const status = useAppSelector(selectors.websocketStatusSelector);

  if (!enabled) { return null; }

  const style: React.CSSProperties = {
    position: 'absolute',
    left: '1em',
    bottom: '1em',
    zIndex: '1',
  };

  switch (status.state) {
    case 'connected':
      style.color = 'green';
      return <div style={style}>⬤</div>;
    case 'disconnected':
      style.color = 'grey';
      return <div style={style}>⬤</div>;
    case 'error':
      style.color = 'red';
      return <div style={style} title={status.error}>⬤</div>;
  }
}

const Playground: React.FC = () => {
  const showNotifications = useAppSelector(selectors.anyNotificationsToShowSelector);

  return (
    <>
      <div className={styles.container}>
        <WebSocketStatus />
        <Header />
        <ResizableArea />
      </div>
      { showNotifications && <Notifications />}
    </>
  );
}

export default Playground;
