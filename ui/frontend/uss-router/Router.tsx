import React, { createContext } from 'react';

export const Context = createContext(undefined);

interface RouterProps {
  router: boolean;
}

const Router: React.SFC<RouterProps> = (props) => {

  return (
    <Context.Provider value={props.router}>
      {props.children}
    </Context.Provider>
  );
};

export default Router;
