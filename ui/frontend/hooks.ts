import { useDispatch, useSelector } from 'react-redux';

import type { AppDispatch } from './configureStore';
import type { State } from './reducers';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<State>();
