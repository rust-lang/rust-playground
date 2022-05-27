import React from 'react';
import { useSelector } from 'react-redux';

import Help from './Help';
import Playground from './Playground';
import { State } from './reducers';

const PageSwitcher: React.FC = () => {
  const page = useSelector((state: State) => state.page);

  switch (page) {
    case 'index':
      return <Playground />;
    case 'help':
      return <Help />;
  }
}

export default PageSwitcher;
