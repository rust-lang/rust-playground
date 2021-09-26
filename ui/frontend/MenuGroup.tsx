import React from 'react';

import styles from './MenuGroup.module.css';

interface MenuGroupProps {
  title: string;
}

const MenuGroup: React.SFC<MenuGroupProps> = ({ title, children }) => (
  <div className={styles.container}>
    <h1 className={styles.title}>{title}</h1>
    <div className={styles.content}>
      {children}
    </div>
  </div>
);

export default MenuGroup;
