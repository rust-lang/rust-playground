import React, { FormEvent, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { wsExecuteStdin } from './reducers/output/execute';
import { enableStdinSelector } from './selectors';

import styles from './Stdin.module.css';

const Stdin: React.FC = () => {
  const dispatch = useDispatch();
  const disabled = !useSelector(enableStdinSelector);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const form = e.currentTarget;
      const formData = new FormData(form);

      const content = formData.get('content')?.valueOf();

      if (content && typeof content === 'string') {
        dispatch(wsExecuteStdin(content + '\n'));
      }

      form.reset();
    },
    [dispatch],
  );

  return (
    <form onSubmit={handleSubmit} className={styles.form} data-test-id="stdin">
      <input
        type="text"
        name="content"
        autoComplete="off"
        className={styles.text}
        disabled={disabled}
      ></input>
      <button type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
};

export default Stdin;
