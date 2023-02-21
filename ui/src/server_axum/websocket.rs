use crate::{
    metrics::{DURATION_WS, LIVE_WS},
    parse_channel, parse_crate_type, parse_edition, parse_mode,
    sandbox::{self, Sandbox},
    Error, ExecutionSnafu, Result, SandboxCreationSnafu, WebSocketTaskPanicSnafu,
};

use axum::extract::ws::{Message, WebSocket};
use snafu::prelude::*;
use std::{
    convert::{TryFrom, TryInto},
    time::Instant,
};
use tokio::{sync::mpsc, task::JoinSet};

#[derive(serde::Deserialize)]
#[serde(tag = "type")]
enum WSMessageRequest {
    #[serde(rename = "WS_EXECUTE_REQUEST")]
    WSExecuteRequest(WSExecuteRequest),
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WSExecuteRequest {
    channel: String,
    mode: String,
    edition: String,
    crate_type: String,
    tests: bool,
    code: String,
    backtrace: bool,
    extra: serde_json::Value,
}

impl TryFrom<WSExecuteRequest> for (sandbox::ExecuteRequest, serde_json::Value) {
    type Error = Error;

    fn try_from(value: WSExecuteRequest) -> Result<Self, Self::Error> {
        let WSExecuteRequest {
            channel,
            mode,
            edition,
            crate_type,
            tests,
            code,
            backtrace,
            extra,
        } = value;

        let req = sandbox::ExecuteRequest {
            channel: parse_channel(&channel)?,
            mode: parse_mode(&mode)?,
            edition: parse_edition(&edition)?,
            crate_type: parse_crate_type(&crate_type)?,
            tests,
            backtrace,
            code,
        };

        Ok((req, extra))
    }
}

#[derive(Debug, serde::Serialize)]
#[serde(tag = "type")]
enum WSMessageResponse {
    #[serde(rename = "WEBSOCKET_ERROR")]
    Error(WSError),
    #[serde(rename = "WS_EXECUTE_RESPONSE")]
    WSExecuteResponse(WSExecuteResponse),
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WSError {
    error: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WSExecuteResponse {
    success: bool,
    stdout: String,
    stderr: String,
    extra: serde_json::Value,
}

impl From<(sandbox::ExecuteResponse, serde_json::Value)> for WSExecuteResponse {
    fn from(value: (sandbox::ExecuteResponse, serde_json::Value)) -> Self {
        let sandbox::ExecuteResponse {
            success,
            stdout,
            stderr,
        } = value.0;
        let extra = value.1;

        WSExecuteResponse {
            success,
            stdout,
            stderr,
            extra,
        }
    }
}

pub async fn handle(mut socket: WebSocket) {
    LIVE_WS.inc();
    let start = Instant::now();

    let (tx, mut rx) = mpsc::channel(3);
    let mut tasks = JoinSet::new();

    // TODO: Implement some kind of timeout to shutdown running work?

    loop {
        tokio::select! {
            request = socket.recv() => {
                match request {
                    None => {
                        // browser disconnected
                        break;
                    }
                    Some(Ok(Message::Text(txt))) => handle_msg(txt, &tx, &mut tasks).await,
                    Some(Ok(_)) => {
                        // unknown message type
                        continue;
                    }
                    Some(Err(e)) => super::record_websocket_error(e.to_string()),
                }
            },
            resp = rx.recv() => {
                let resp = resp.expect("The rx should never close as we have a tx");
                let resp = resp.unwrap_or_else(error_to_response);
                let resp = response_to_message(resp);

                if let Err(_) = socket.send(resp).await {
                    // We can't send a response
                    break;
                }
            },
            // We don't care if there are no running tasks
            Some(task) = tasks.join_next() => {
                let Err(error) = task else { continue };
                // The task was cancelled; no need to report
                let Ok(panic) = error.try_into_panic() else { continue };

                let text = match panic.downcast::<String>() {
                    Ok(text) => *text,
                    Err(panic) => match panic.downcast::<&str>() {
                        Ok(text) => text.to_string(),
                        _ => "An unknown panic occurred".into(),
                    }
                };
                let error = WebSocketTaskPanicSnafu { text }.build();

                let resp = error_to_response(error);
                let resp = response_to_message(resp);

                if let Err(_) = socket.send(resp).await {
                    // We can't send a response
                    break;
                }
            },
        }
    }

    drop((tx, rx, socket));
    tasks.shutdown().await;

    LIVE_WS.dec();
    let elapsed = start.elapsed();
    DURATION_WS.observe(elapsed.as_secs_f64());
}

fn error_to_response(error: Error) -> WSMessageResponse {
    let error = error.to_string();
    WSMessageResponse::Error(WSError { error })
}

fn response_to_message(response: WSMessageResponse) -> Message {
    const LAST_CHANCE_ERROR: &str =
        r#"{ "type": "WEBSOCKET_ERROR", "error": "Unable to serialize JSON" }"#;
    let resp = serde_json::to_string(&response).unwrap_or_else(|_| LAST_CHANCE_ERROR.into());
    Message::Text(resp)
}

async fn handle_msg(
    txt: String,
    tx: &mpsc::Sender<Result<WSMessageResponse>>,
    tasks: &mut JoinSet<Result<()>>,
) {
    use WSMessageRequest::*;

    let msg = serde_json::from_str(&txt).context(crate::DeserializationSnafu);

    match msg {
        Ok(WSExecuteRequest(req)) => {
            let tx = tx.clone();
            tasks.spawn(async move {
                let resp = handle_execute(req).await;
                tx.send(resp).await.ok(/* We don't care if the channel is closed */);
                Ok(())
            });
        }
        Err(e) => {
            let resp = Err(e);
            tx.send(resp).await.ok(/* We don't care if the channel is closed */);
        }
    }
}

async fn handle_execute(req: WSExecuteRequest) -> Result<WSMessageResponse> {
    let sb = Sandbox::new().await.context(SandboxCreationSnafu)?;

    let (req, extra) = req.try_into()?;
    let resp = sb.execute(&req).await.context(ExecutionSnafu)?;
    Ok(WSMessageResponse::WSExecuteResponse((resp, extra).into()))
}
