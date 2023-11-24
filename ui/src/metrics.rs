use futures::future::BoxFuture;
use lazy_static::lazy_static;
use orchestrator::coordinator;
use prometheus::{
    self, register_histogram, register_histogram_vec, register_int_counter,
    register_int_counter_vec, register_int_gauge, Histogram, HistogramVec, IntCounter,
    IntCounterVec, IntGauge,
};
use regex::Regex;
use std::{
    future::Future,
    time::{Duration, Instant},
};

use crate::sandbox::{self, Channel, CompileTarget, CrateType, Edition, Mode};

lazy_static! {
    pub(crate) static ref REQUESTS: HistogramVec = register_histogram_vec!(
        "playground_request_duration_seconds",
        "Number of requests made",
        Labels::LABELS,
        vec![0.1, 1.0, 2.5, 5.0, 10.0, 15.0]
    )
    .unwrap();
    pub(crate) static ref LIVE_WS: IntGauge = register_int_gauge!(
        "playground_active_websocket_connections_count",
        "Number of active WebSocket connections"
    )
    .unwrap();
    pub(crate) static ref DURATION_WS: Histogram = register_histogram!(
        "playground_websocket_duration_seconds",
        "WebSocket connection length",
        vec![15.0, 60.0, 300.0, 600.0, 1800.0, 3600.0, 7200.0]
    )
    .unwrap();
    pub(crate) static ref UNAVAILABLE_WS: IntCounter = register_int_counter!(
        "playground_websocket_unavailability_count",
        "Number of failed WebSocket connections"
    )
    .unwrap();
    pub(crate) static ref WS_INCOMING: IntCounter = register_int_counter!(
        "playground_websocket_incoming_messages_count",
        "Number of WebSocket messages received"
    )
    .unwrap();
    pub(crate) static ref WS_OUTGOING: IntCounterVec = register_int_counter_vec!(
        "playground_websocket_outgoing_messages_count",
        "Number of WebSocket messages sent",
        &["success"],
    )
    .unwrap();
}

#[derive(Debug, Copy, Clone, strum::IntoStaticStr)]
pub(crate) enum Endpoint {
    Compile,
    Execute,
    Format,
    Miri,
    Clippy,
    MacroExpansion,
    MetaCrates,
    MetaVersionStable,
    MetaVersionBeta,
    MetaVersionNightly,
    MetaVersionRustfmt,
    MetaVersionClippy,
    MetaVersionMiri,
    Evaluate,
}

#[derive(Debug, Copy, Clone, strum::IntoStaticStr)]
pub(crate) enum Outcome {
    Success,
    ErrorServer,
    ErrorTimeoutSoft,
    ErrorTimeoutHard,
    ErrorUserCode,
    Abandoned,
}

pub(crate) struct LabelsCore {
    target: Option<CompileTarget>,
    channel: Option<Channel>,
    mode: Option<Mode>,
    edition: Option<Option<Edition>>,
    crate_type: Option<CrateType>,
    tests: Option<bool>,
    backtrace: Option<bool>,
}

#[derive(Debug, Copy, Clone)]
pub(crate) struct Labels {
    endpoint: Endpoint,
    outcome: Outcome,

    target: Option<CompileTarget>,
    channel: Option<Channel>,
    mode: Option<Mode>,
    edition: Option<Option<Edition>>,
    crate_type: Option<CrateType>,
    tests: Option<bool>,
    backtrace: Option<bool>,
}

impl Labels {
    const COUNT: usize = 9;

    const LABELS: &'static [&'static str; Self::COUNT] = &[
        "endpoint",
        "outcome",
        "target",
        "channel",
        "mode",
        "edition",
        "crate_type",
        "tests",
        "backtrace",
    ];

    fn as_values(&self) -> [&'static str; Self::COUNT] {
        let Self {
            endpoint,
            outcome,
            target,
            channel,
            mode,
            edition,
            crate_type,
            tests,
            backtrace,
        } = *self;

        fn b(v: Option<bool>) -> &'static str {
            v.map_or("", |v| if v { "true" } else { "false" })
        }

        let target = target.map_or("", Into::into);
        let channel = channel.map_or("", Into::into);
        let mode = mode.map_or("", Into::into);
        let edition = match edition {
            None => "",
            Some(None) => "Unspecified",
            Some(Some(v)) => v.into(),
        };
        let crate_type = crate_type.map_or("", Into::into);
        let tests = b(tests);
        let backtrace = b(backtrace);

        [
            endpoint.into(),
            outcome.into(),
            target,
            channel,
            mode,
            edition,
            crate_type,
            tests,
            backtrace,
        ]
    }

    pub(crate) fn complete(endpoint: Endpoint, labels_core: LabelsCore, outcome: Outcome) -> Self {
        let LabelsCore {
            target,
            channel,
            mode,
            edition,
            crate_type,
            tests,
            backtrace,
        } = labels_core;
        Self {
            endpoint,
            outcome,
            target,
            channel,
            mode,
            edition,
            crate_type,
            tests,
            backtrace,
        }
    }
}

pub(crate) trait GenerateLabels {
    fn generate_labels(&self, outcome: Outcome) -> Labels;
}

impl<T> GenerateLabels for &'_ T
where
    T: GenerateLabels,
{
    fn generate_labels(&self, outcome: Outcome) -> Labels {
        T::generate_labels(self, outcome)
    }
}

impl GenerateLabels for sandbox::MiriRequest {
    fn generate_labels(&self, outcome: Outcome) -> Labels {
        let Self { code: _, edition } = *self;

        Labels {
            endpoint: Endpoint::Miri,
            outcome,

            target: None,
            channel: None,
            mode: None,
            edition: Some(edition),
            crate_type: None,
            tests: None,
            backtrace: None,
        }
    }
}

impl GenerateLabels for sandbox::MacroExpansionRequest {
    fn generate_labels(&self, outcome: Outcome) -> Labels {
        let Self { code: _, edition } = *self;

        Labels {
            endpoint: Endpoint::MacroExpansion,
            outcome,

            target: None,
            channel: None,
            mode: None,
            edition: Some(edition),
            crate_type: None,
            tests: None,
            backtrace: None,
        }
    }
}

pub(crate) trait SuccessDetails: Sized {
    fn success_details(&self) -> Outcome;

    fn for_sandbox_result(r: &Result<Self, sandbox::Error>) -> Outcome {
        use sandbox::Error::*;

        match r {
            Ok(v) => v.success_details(),
            Err(CompilerExecutionTimedOut { .. }) => Outcome::ErrorTimeoutHard,
            Err(_) => Outcome::ErrorServer,
        }
    }
}

fn common_success_details(success: bool, stderr: &str) -> Outcome {
    lazy_static! {
        // Memory allocation failures are "Aborted"
        static ref SOFT_TIMEOUT_REGEX: Regex = Regex::new("entrypoint.sh.*Killed.*timeout").unwrap();
    }

    match success {
        true => Outcome::Success,
        false => {
            if stderr
                .lines()
                .next_back()
                .map_or(false, |l| SOFT_TIMEOUT_REGEX.is_match(l))
            {
                Outcome::ErrorTimeoutSoft
            } else {
                Outcome::ErrorUserCode
            }
        }
    }
}

impl SuccessDetails for sandbox::MiriResponse {
    fn success_details(&self) -> Outcome {
        common_success_details(self.success, &self.stderr)
    }
}

impl SuccessDetails for sandbox::MacroExpansionResponse {
    fn success_details(&self) -> Outcome {
        common_success_details(self.success, &self.stderr)
    }
}

impl SuccessDetails for Vec<sandbox::CrateInformation> {
    fn success_details(&self) -> Outcome {
        Outcome::Success
    }
}

impl SuccessDetails for sandbox::Version {
    fn success_details(&self) -> Outcome {
        Outcome::Success
    }
}

pub(crate) async fn track_metric_async<Req, B, Resp>(request: Req, body: B) -> sandbox::Result<Resp>
where
    Req: GenerateLabels,
    for<'req> B: FnOnce(&'req Req) -> BoxFuture<'req, sandbox::Result<Resp>>,
    Resp: SuccessDetails,
{
    track_metric_common_async(request, body, |_| {}).await
}

async fn track_metric_common_async<Req, B, Resp, F>(
    request: Req,
    body: B,
    f: F,
) -> sandbox::Result<Resp>
where
    Req: GenerateLabels,
    for<'req> B: FnOnce(&'req Req) -> BoxFuture<'req, sandbox::Result<Resp>>,
    Resp: SuccessDetails,
    F: FnOnce(&mut Labels),
{
    let start = Instant::now();
    let response = body(&request).await;
    let elapsed = start.elapsed();

    let outcome = SuccessDetails::for_sandbox_result(&response);
    let mut labels = request.generate_labels(outcome);
    f(&mut labels);

    record_metric_complete(labels, elapsed);

    response
}

pub(crate) async fn track_metric_no_request_async<B, Fut, Resp>(
    endpoint: Endpoint,
    body: B,
) -> crate::Result<Resp>
where
    B: FnOnce() -> Fut,
    Fut: Future<Output = crate::Result<Resp>>,
{
    let start = Instant::now();
    let response = body().await;
    let elapsed = start.elapsed();

    let outcome = if response.is_ok() {
        Outcome::Success
    } else {
        Outcome::ErrorServer
    };
    let labels = Labels {
        endpoint,
        outcome,
        target: None,
        channel: None,
        mode: None,
        edition: None,
        crate_type: None,
        tests: None,
        backtrace: None,
    };

    record_metric_complete(labels, elapsed);

    response
}

pub(crate) trait HasLabelsCore {
    fn labels_core(&self) -> LabelsCore;
}

impl HasLabelsCore for coordinator::CompileRequest {
    fn labels_core(&self) -> LabelsCore {
        let Self {
            target,
            channel,
            crate_type,
            mode,
            edition,
            tests,
            backtrace,
            code: _,
        } = *self;

        LabelsCore {
            target: Some(target.into()),
            channel: Some(channel.into()),
            mode: Some(mode.into()),
            edition: Some(Some(edition.into())),
            crate_type: Some(crate_type.into()),
            tests: Some(tests),
            backtrace: Some(backtrace),
        }
    }
}

impl HasLabelsCore for coordinator::ExecuteRequest {
    fn labels_core(&self) -> LabelsCore {
        let Self {
            channel,
            crate_type,
            mode,
            edition,
            tests,
            backtrace,
            code: _,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel.into()),
            mode: Some(mode.into()),
            edition: Some(Some(edition.into())),
            crate_type: Some(crate_type.into()),
            tests: Some(tests),
            backtrace: Some(backtrace),
        }
    }
}

impl HasLabelsCore for coordinator::FormatRequest {
    fn labels_core(&self) -> LabelsCore {
        let Self {
            channel,
            crate_type,
            edition,
            code: _,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel.into()),
            mode: None,
            edition: Some(Some(edition.into())),
            crate_type: Some(crate_type.into()),
            tests: None,
            backtrace: None,
        }
    }
}

impl HasLabelsCore for coordinator::ClippyRequest {
    fn labels_core(&self) -> LabelsCore {
        let Self {
            channel,
            crate_type,
            edition,
            code: _,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel.into()),
            mode: None,
            edition: Some(Some(edition.into())),
            crate_type: Some(crate_type.into()),
            tests: None,
            backtrace: None,
        }
    }
}

pub(crate) fn record_metric(
    endpoint: Endpoint,
    labels_core: LabelsCore,
    outcome: Outcome,
    elapsed: Duration,
) {
    let labels = Labels::complete(endpoint, labels_core, outcome);
    record_metric_complete(labels, elapsed)
}

fn record_metric_complete(labels: Labels, elapsed: Duration) {
    let values = &labels.as_values();
    let histogram = REQUESTS.with_label_values(values);
    histogram.observe(elapsed.as_secs_f64());
}
