import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export const FunctionalIFrameComponent = ({
  children,
  url,
  ...props
}) => {
  const [contentRef, setContentRef] = useState(null)
  const document =
    contentRef?.contentWindow?.document;
  const mountNode = document?.body;

  useEffect(() => {
    if (document) {
      const script = document.createElement('script');
      script.src = url;
      script.type = 'module';
      script.async = true;
      mountNode && mountNode.appendChild(script);
    }

    return () => {
      if (mountNode) {
        mountNode.innerHTML = ''
      }
    };
  }, [mountNode, document, url]);

  return (
    <iframe {...props} ref={setContentRef} scrolling='no' className='container'>
      {mountNode && createPortal(children, mountNode)}
    </iframe>
  )
}
