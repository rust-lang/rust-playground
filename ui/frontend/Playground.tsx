import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Split from 'split-grid';

import Editor from './editor/Editor';
import Header from './Header';
import Notifications from './Notifications';
import Output from './Output';
import * as selectors from './selectors';
import { Orientation } from './types';

import styles from './Playground.module.css';
import { useKeyDown } from './hooks/shortcuts';
import { useAppDispatch } from './configureStore';

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
  const somethingToShow = useSelector(selectors.getSomethingToShow);
  const isFocused = useSelector(selectors.isOutputFocused);
  const orientation = useSelector(selectors.orientation);

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
  const enabled = useSelector(selectors.showGemSelector);
  const status = useSelector(selectors.websocketStatusSelector);

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
  const showNotifications = useSelector(
    selectors.anyNotificationsToShowSelector
  );

  const dispatch = useAppDispatch();
  const handleRustFmt = useCallback((_event) => {
    dispatch(actions.performFormat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleClippy = useCallback((_event) => {
    dispatch(actions.performClippy());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleMiri = useCallback((_event) => {
    dispatch(actions.performMiri());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleMacroExpansion = useCallback((_event) => {
    dispatch(actions.performMacroExpansion());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortcutMap = new Map([
    [['Control', 'Alt', 'f'], handleRustFmt],
    [['Control', 'Alt', 'c'], handleClippy],
    [['Control', 'Alt', 'm'], handleMiri],
    [['Control', 'Alt', 'x'], handleMacroExpansion],
  ]);
  useKeyDown(shortcutMap);

  return (
    <>
      <div className={styles.container}>
        <WebSocketStatus />
        <Header />
        <ResizableArea />
      </div>
      {showNotifications && <Notifications />}
    </>
  );
}

export default Playground;
