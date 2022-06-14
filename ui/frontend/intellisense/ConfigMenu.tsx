import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { getIntellisenseConfig, setConfig } from './config';
import styles from './ConfigMenu.module.css';
import { availableVersions, selectVersion } from './crates';

const ConfigMenu: React.FC<{ onDone: (result?: string | undefined) => void }> = ({ onDone }) => {
  const { enable, diagnostic } = getIntellisenseConfig();
  const [nextEnable, setEnable] = useState(enable);
  const [nextDiag, setDiag] = useState(diagnostic);
  const [nextStdlib, setNextStdlib] = useState(undefined);
  const [stdlibVersions, setStdlibVersions] = useState(undefined);
  useEffect(() => {
    (async () => {
      const x = await availableVersions('stdlib');
      setStdlibVersions(x);
      setNextStdlib(x.selected);
    })();
  }, []);
  let stdlibVersionsElement = <>Loading...</>;
  if (stdlibVersions) {
    stdlibVersionsElement = (
      <>
        <span onClick={() => setNextStdlib(stdlibVersions.selected)}>
          <input type="radio" checked={nextStdlib === stdlibVersions.selected} />{stdlibVersions.selected} (downloaded)
        </span>
        {stdlibVersions.others.map((x: string) => <span key={x} onClick={() => setNextStdlib(x)}>
          {' '}<input type="radio" checked={nextStdlib === x} />{x}
        </span>)}
      </>
    )
  }
  return (
    <div>
      <div className={styles.main}>
        <div>
          Enabled: <input type="checkbox" checked={nextEnable} onChange={() => setEnable(!nextEnable)} />
          <br />
          {nextEnable && <>
            Diagnostics: <input type="checkbox" checked={nextDiag} onChange={() => setDiag(!nextDiag)} />
            <br />
            Standard library version: {stdlibVersionsElement}
          </>}
        </div>
        <button onClick={() => {
          selectVersion('stdlib', nextStdlib);
          setConfig({
            enable: nextEnable,
            suggest: false,
            diagnostic: nextDiag,
          })
          window.location.reload();
        }}>Save</button>
      </div>
      <div className={styles.root} onClick={() => onDone()} />
    </div>
  );
};

export const configDialog = (): Promise<string | undefined> => {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return new Promise((res) => {
    ReactDOM.render(<ConfigMenu onDone={(result) => {
      document.body.removeChild(div);
      res(result);
    }} />, div);
  });
};
