import { Middleware } from 'redux';
import { z } from 'zod';

import {
  ActionType,
  WSExecuteResponse,
  WebSocketError,
  websocketConnected,
  websocketDisconnected,
  websocketError,
} from './actions';

const WSMessageResponse = z.discriminatedUnion('type', [WebSocketError, WSExecuteResponse]);

const reportWebSocketError = async (error: string) => {
  try {
    await fetch('/nowebsocket', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error }),
    });
  } catch (reportError) {
    console.log('Unable to report WebSocket error', error, reportError);
  }
}

const openWebSocket = (currentLocation: Location) => {
  try {
    const wsProtocol = currentLocation.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUri = [wsProtocol, currentLocation.host, '/websocket'].join('');
    return new WebSocket(wsUri);
  } catch (e) {
    // WebSocket URL error or WebSocket is not supported by browser.
    // Assume it's the second case since URL error is easy to notice.
    const detail = (e instanceof Error) ? e.toString() : 'An unknown error occurred';
    reportWebSocketError(`Could not create the WebSocket: ${detail}`)

    return null;
  }
}

export const websocketMiddleware = (window: Window): Middleware => store => {
  const socket = openWebSocket(window.location);

  if (socket) {
    socket.addEventListener('open', () => {
      store.dispatch(websocketConnected());
    });

    socket.addEventListener('close', () => {
      store.dispatch(websocketDisconnected());
    });

    socket.addEventListener('error', () => {
      // We cannot get detailed information about the failure
      // https://stackoverflow.com/a/31003057/155423
      const error = 'Generic WebSocket Error';
      store.dispatch(websocketError(error));
      reportWebSocketError(error);
    });

    // TODO: reconnect on error? (if ever connected? if < n failures?)

    socket.addEventListener('message', (event) => {
      try {
        const rawMessage = JSON.parse(event.data);
        const message = WSMessageResponse.parse(rawMessage);
        store.dispatch(message);
      } catch (e) {
        console.log('Unable to parse WebSocket message', event.data, e);
      }
    });
  }

  return next => action => {
    if (socket && socket.readyState == socket.OPEN && sendActionOnWebsocket(action)) {
      const message = JSON.stringify(action);
      socket.send(message);
    }

    next(action);
  };
}

const sendActionOnWebsocket = (action: any): boolean =>
  action.type === ActionType.WSExecuteRequest;
