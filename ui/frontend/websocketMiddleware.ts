import { Middleware } from '@reduxjs/toolkit';
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
};

const openWebSocket = (currentLocation: Location) => {
  try {
    const wsProtocol = currentLocation.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUri = [wsProtocol, currentLocation.host, '/websocket'].join('');
    return new WebSocket(wsUri);
  } catch (e) {
    // WebSocket URL error or WebSocket is not supported by browser.
    // Assume it's the second case since URL error is easy to notice.
    const detail = e instanceof Error ? e.toString() : 'An unknown error occurred';
    reportWebSocketError(`Could not create the WebSocket: ${detail}`);

    return null;
  }
};

// https://exponentialbackoffcalculator.com
const backoffMs = (n: number) => Math.min(100 * Math.pow(2, n), 10000);

const idleTimeoutMs = 60 * 60 * 1000;

export const websocketMiddleware =
  (window: Window): Middleware =>
  (store) => {
    let socket: WebSocket | null = null;
    let wasConnected = false;
    let reconnectAttempt = 0;

    let timeout: number | null = null;
    const resetTimeout = () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }

      timeout = window.setTimeout(() => {
        if (!socket) {
          return;
        }

        socket.close();
      }, idleTimeoutMs);
    };

    const connect = () => {
      socket = openWebSocket(window.location);
      if (socket) {
        resetTimeout();

        socket.addEventListener('open', () => {
          store.dispatch(websocketConnected());

          wasConnected = true;
        });

        socket.addEventListener('close', (event) => {
          store.dispatch(websocketDisconnected());

          // Reconnect if we've previously connected
          if (wasConnected && !event.wasClean) {
            wasConnected = false;
            reconnectAttempt = 0;
            reconnect();
          }
        });

        socket.addEventListener('error', () => {
          // We cannot get detailed information about the failure
          // https://stackoverflow.com/a/31003057/155423
          const error = 'Generic WebSocket Error';
          store.dispatch(websocketError(error));
          reportWebSocketError(error);
        });

        socket.addEventListener('message', (event) => {
          try {
            const rawMessage = JSON.parse(event.data);
            const message = WSMessageResponse.parse(rawMessage);
            store.dispatch(message);
            resetTimeout();
          } catch (e) {
            console.log('Unable to parse WebSocket message', event.data, e);
          }
        });
      }
    };

    const reconnect = () => {
      if (socket && socket.readyState == socket.OPEN) {
        return;
      }

      connect();

      const delay = backoffMs(reconnectAttempt);
      reconnectAttempt += 1;
      setTimeout(reconnect, delay);
    };

    connect();

    return (next) => (action) => {
      if (socket && socket.readyState == socket.OPEN && sendActionOnWebsocket(action)) {
        const message = JSON.stringify(action);
        socket.send(message);
        resetTimeout();
      }

      next(action);
    };
  };

const sendActionOnWebsocket = (action: any): boolean => action.type === ActionType.WSExecuteRequest;
