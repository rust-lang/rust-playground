import React from 'react';

import MenuItem from './MenuItem';

interface ButtonMenuItemProps extends React.HTMLProps<HTMLButtonElement> {
  name: string;
}

const ButtonMenuItem: React.SFC<ButtonMenuItemProps> = ({ name, children, ...props }) => (
  <MenuItem>
    <button className="button-menu-item" {...props}>
      <div className="button-menu-item__name">{name}</div>
      <div className="button-menu-item__description">{children}</div>
    </button>
  </MenuItem>
);

export default ButtonMenuItem;
