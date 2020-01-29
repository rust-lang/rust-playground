import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { Rnd } from 'react-rnd';

import * as actions from './actions';
import { Close as CloseIcon, RustfmtModalHelpIcon } from './Icon';

import TomlEditor from './TomlEditor';
import State from './state';

const ModalDefaultWidth = 320;
const ModalDefaultHeight = 200;
const DefaultState = {
  x: (window.innerWidth / 2) - ModalDefaultWidth,
  y: (window.innerHeight / 2) - ModalDefaultHeight,
  width: ModalDefaultWidth,
  height: ModalDefaultHeight,
};

const RustfmtTomlModal: React.SFC = () => {
  const toml = useSelector((state: State) => state.rustfmt.toml);
  const dispatch = useDispatch();

  const onEditRustfmt = useCallback((c) => dispatch(actions.editRustfmtToml(c)), [dispatch]);
  const formatDialog = useCallback(() => {
    dispatch(actions.toggleRustfmtTomlModalShow());
  }, [dispatch]);

  const Close = <button className="button-menu-item" title="Close Dialog" onClick={formatDialog}>
    <CloseIcon />
  </button>

  return (
    <Rnd
      className="rustfmt-modal"
      default={DefaultState}
      cancel=".toml-input-area"
    >
      <div className="backbone">
        <div className="toml-header">
          <div className="toml-header-label">rustfmt.toml</div>
          <div className="icon-areas">
            <HelpIcon />
            {Close}
          </div>
        </div>
        <TomlEditor
          toml={toml}
          onEditCode={onEditRustfmt} />
      </div>
    </Rnd>
  );
};

const HelpIcon: React.SFC = () => (
  <a title="View help" href="https://rust-lang.github.io/rustfmt">
    <RustfmtModalHelpIcon />
  </a>
);

export default RustfmtTomlModal;
