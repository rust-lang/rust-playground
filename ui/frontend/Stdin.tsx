import React, { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { wsExecuteStdin } from './reducers/output/execute';
import { enableStdinSelector } from './selectors';

import styles from './Stdin.module.css';

const Stdin: React.FC = () => {
  const dispatch = useDispatch();
  const disabled = !useSelector(enableStdinSelector);

  const [content, setContent] = useState('');

  const form = useRef<HTMLFormElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.current?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    },
    [dispatch, form, content],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.currentTarget.value);
    },
    [setContent],
  );

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      dispatch(wsExecuteStdin(content + '\n'));

      setContent('');
    },
    [dispatch, content, setContent],
  );

  return (
    <form onSubmit={handleSubmit} className={styles.form} data-test-id="stdin" ref={form}>
      <div className={styles.multiLine}>
        <textarea
          rows={1}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          name="content"
          autoComplete="off"
          spellCheck="false"
          className={styles.text}
          value={content}
          disabled={disabled}
        ></textarea>
        <p className={styles.sizer}>{content} </p>
      </div>
      <button type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
};

export default Stdin;
