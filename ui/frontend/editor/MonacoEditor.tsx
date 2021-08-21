import React, { Suspense } from 'react';

import { CommonEditorProps } from '../types';

const MonacoEditorLazy = React.lazy(() => import('./MonacoEditorCore'));

const MonacoEditor: React.SFC<CommonEditorProps> = props => (
  <Suspense fallback={'Loading'}>
    <MonacoEditorLazy {...props} />
  </Suspense>
)

export default MonacoEditor;
