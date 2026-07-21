import React from 'react';

import * as styles from './Icon.module.css';

// These icons came from Material Design originally
// https://material.io/tools/icons/?icon=assignment&style=outline

type IconProps = { className?: string };

function addClassName(className?: string) {
  if (className) {
    return `${styles.icon} ${className}`;
  } else {
    return styles.icon;
  }
}

// M.D. 'play_arrow'
export const BuildIcon = () => (
  <svg className={styles.icon} height="14" viewBox="8 4 10 16" width="12" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z" />
  </svg>
);

// M.D. 'keyboard_arrow_down'
export const ExpandableIcon = () => (
  <svg className={styles.icon} height="10" viewBox="6 8 12 8" width="10" opacity="0.5" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
  </svg>
);

// M.D. 'more_horiz'
export const MoreOptionsIcon = () => (
  <svg className={styles.icon} height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

export const MoreOptionsActiveIcon = () => (
  <svg className={styles.icon} height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" fill="#428bca" d="M4,5 h16 a3,3 0 0,1 3,3 v8 a3,3 0 0,1 -3,3 h-16 a3,3 0 0,1 -3,-3 v-8 a3,3 0 0,1 3,-3 Z M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

// M.D. 'settings',
export const ConfigIcon = () => (
  <svg className={styles.icon} height="15" viewBox="0 0 24 24" width="15" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
  </svg>
);

// M.D. 'help_outline'
export const HelpIcon = () => (
  <svg className={styles.icon} height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" />
  </svg>
);

export const CheckmarkIcon = () => (
  <svg className={styles.icon} height="18" viewBox="2 2 22 22" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

// M.D. 'assignment' (outline)
export const ClipboardIcon = () => (
  <svg className={styles.icon} height="18" width="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="15" width="7" height="2" />
    <rect x="7" y="11" width="10" height="2" />
    <rect x="7" y="7" width="10" height="2" />
    <path d="M19,3L19,3h-4.18C14.4,1.84,13.3,1,12,1c-1.3,0-2.4,0.84-2.82,2H5h0C4.86,3,4.73,3.01,4.6,3.04 C4.21,3.12,3.86,3.32,3.59,3.59c-0.18,0.18-0.33,0.4-0.43,0.64C3.06,4.46,3,4.72,3,5v14c0,0.27,0.06,0.54,0.16,0.78 c0.1,0.24,0.25,0.45,0.43,0.64c0.27,0.27,0.62,0.47,1.01,0.55C4.73,20.99,4.86,21,5,21h0h14h0c1.1,0,2-0.9,2-2V5 C21,3.9,20.1,3,19,3z M12,2.75c0.41,0,0.75,0.34,0.75,0.75c0,0.41-0.34,0.75-0.75,0.75c-0.41,0-0.75-0.34-0.75-0.75 C11.25,3.09,11.59,2.75,12,2.75z M19,19H5V5h14V19z" />
  </svg>
);

// M.D. 'close'
export const Close = () => (
  <svg className={styles.icon} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41z" />
  </svg>
);

// M.D. 'insert_drive_file'
export const File: React.FC<IconProps> = ({ className }) => (
  <svg className={addClassName(className)} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none"/><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
    </svg>
);

// M.D. 'folder'
export const Directory: React.FC<IconProps> = ({ className }) => (
  <svg className={addClassName(className)} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none"/><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
);

// M.D. 'note_add'
export const FileAdd = () => (
  <svg className={styles.icon} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none"/><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z"/>
    </svg>
);

// M.D. 'delete_forever'
export const DeleteForever = () => (
  <svg className={styles.icon} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none"/>
    <path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
);

// M.D. 'edit'
export const Edit = () => (
  <svg className={styles.icon} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none"/>
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
);

// M.D. 'check_circle'
export const CheckCircle = () => (
  <svg className={styles.icon} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
);

// M.D. 'cancel'
export const Cancel = () => (
  <svg className={styles.icon} width="24px" height="24px" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
    </svg>
);
