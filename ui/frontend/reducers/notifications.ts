import { createSlice } from '@reduxjs/toolkit';

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
  seenRustSurvey2024: boolean; // expired
  seenRust2024IsDefault: boolean; // expired
  seenRustSurvey2025: boolean; // expired
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
  seenRustSurvey2024: true,
  seenRust2024IsDefault: true,
  seenRustSurvey2025: true,
};

const slice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    notificationSeen: (state) => state,
  },
});

export default slice.reducer;
