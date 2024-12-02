import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Notification } from '../types';

interface State {
  seenRustSurvey2018: boolean; // expired
  seenRust2018IsDefault: boolean; // expired
  seenRustSurvey2020: boolean; // expired
  seenRust2021IsDefault: boolean; // expired
  seenRustSurvey2021: boolean; // expired
  seenMonacoEditorAvailable: boolean; // expired
  seenRustSurvey2022: boolean; // expired
  seenRustSurvey2023: boolean; // expired
  seenDarkMode: boolean; // expired
  seenRustSurvey2024: boolean;
}

const initialState: State = {
  seenRustSurvey2018: true,
  seenRust2018IsDefault: true,
  seenRustSurvey2020: true,
  seenRust2021IsDefault: true,
  seenRustSurvey2021: true,
  seenMonacoEditorAvailable: true,
  seenRustSurvey2022: true,
  seenRustSurvey2023: true,
  seenDarkMode: true,
  seenRustSurvey2024: false,
};

const slice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    notificationSeen: (state, action: PayloadAction<Notification>) => {
      switch (action.payload) {
        case Notification.RustSurvey2024: {
          state.seenRustSurvey2024 = true;
          break;
        }
      }
    },
  },
});

const { notificationSeen } = slice.actions;

export const seenRustSurvey2024 = () => notificationSeen(Notification.RustSurvey2024);

export default slice.reducer;
