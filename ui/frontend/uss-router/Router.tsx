import React, { createContext } from 'react';

import { RouterObject } from '.';

export const Context = createContext<RouterObject | undefined>(undefined);

interface RouterProps {
  children: React.ReactNode;
  router: RouterObject;
}

const Router: React.FC<RouterProps> = ({router, children}) => (
  <Context.Provider value={router}>
    {children}
  </Context.Provider>
);

export default Router;
