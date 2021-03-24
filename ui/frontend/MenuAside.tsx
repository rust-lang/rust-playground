import React from 'react';

import styles from './MenuAside.module.css';

const MenuAside: React.SFC = ({ children }) => (
  <p className={styles.aside}>
    {children}
  </p>
);

export default MenuAside;
