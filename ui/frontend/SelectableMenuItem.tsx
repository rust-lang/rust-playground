import React from 'react';

import { CheckmarkIcon } from './Icon';
import MenuItem from './MenuItem';

type Button = JSX.IntrinsicElements['button'];

interface SelectableMenuItemProps extends Button {
  name: string;
  selected: boolean;
}

const SelectableMenuItem: React.SFC<SelectableMenuItemProps> = ({ name, selected, children, ...props }) => (
  <MenuItem>
    <button className={`selectable-item ${selected ? 'selectable-item--selected' : ''}`} {...props}>
      <div className="selectable-item__header">
        <span className="selectable-item__checkmark">
          <CheckmarkIcon />
        </span>
        <span className="selectable-item__name">{name}</span>
      </div>
      <div className="selectable-item__description">{children}</div>
    </button>
  </MenuItem>
);

export default SelectableMenuItem;
