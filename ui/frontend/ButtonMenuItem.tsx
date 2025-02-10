import React, { type JSX } from 'react';

import MenuItem from './MenuItem';

import * as styles from './ButtonMenuItem.module.css';

type Button = JSX.IntrinsicElements['button'];

interface ButtonMenuItemProps extends Button {
  children: React.ReactNode;
  name: string;
}

const ButtonMenuItem: React.FC<ButtonMenuItemProps> = ({ name, children, ...props }) => (
  <MenuItem>
    <button className={styles.container} {...props}>
      <div className={styles.name} data-test-id="button-menu-item__name">{name}</div>
      <div className={styles.description}>{children}</div>
    </button>
  </MenuItem>
);

export default ButtonMenuItem;
