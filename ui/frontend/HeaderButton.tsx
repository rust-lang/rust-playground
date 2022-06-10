import React from 'react';

import { ExpandableIcon } from './Icon';

import styles from './HeaderButton.module.css';

interface HeaderButtonProps {
  bold?: boolean;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isExpandable?: boolean;
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ bold, icon, rightIcon, isExpandable, children }) => {
  const c = [styles.container];

  if (bold) { c.push(styles.bold); }
  if (icon) { c.push(styles.hasLeftIcon); }
  if (rightIcon) { c.push(styles.hasRightIcon); }
  if (isExpandable) { c.push(styles.expandable); }
  if ((icon || rightIcon) && !isExpandable && !children) { c.push(styles.iconOnly); }

  return (
    <div className={c.join(' ')}>
      {icon && <div className={styles.leftIcon}>{icon}</div>}
      { children}
      { rightIcon && <div className={styles.rightIcon}>{rightIcon}</div>}
      { isExpandable && <div className={styles.drop}><ExpandableIcon /></div>}
    </div>
  );
};

export default HeaderButton;
