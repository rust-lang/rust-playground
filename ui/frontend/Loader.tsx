import React from 'react';

import styles from './Loader.module.css';

const Loader: React.FC = () => (
  <div>
    <span className={styles.dot}>⬤</span>
    <span className={styles.dot}>⬤</span>
    <span className={styles.dot}>⬤</span>
  </div>
);

export default Loader;
