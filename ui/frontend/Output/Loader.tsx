import React from 'react';

import GenericLoader from '../Loader';
import Header from './Header';

const Loader: React.SFC = () => (
  <div>
    <Header label="Progress" />
    <GenericLoader />
  </div>
);

export default Loader;
