use lazy_static::lazy_static;
use orchestrator::coordinator::{self, Channel, CompileTarget, CrateType, Edition, Mode};
use prometheus::{
    register_histogram, register_histogram_vec, register_int_counter, register_int_counter_vec,
    register_int_gauge, Histogram, HistogramVec, IntCounter, IntCounterVec, IntGauge,
};
use std::{
    future::Future,
    time::{Duration, Instant},
};

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
    MetaVersions,
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
    cargo_script: Option<bool>,
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

        let target = match target {
            Some(CompileTarget::Assembly(_, _, _)) => "Assembly",
            Some(CompileTarget::Hir) => "Hir",
            Some(CompileTarget::LlvmIr) => "LlvmIr",
            Some(CompileTarget::Mir) => "Mir",
            Some(CompileTarget::Wasm) => "Wasm",
            None => "",
        };
        let channel = match channel {
            Some(Channel::Stable) => "Stable",
            Some(Channel::Beta) => "Beta",
            Some(Channel::Nightly) => "Nightly",
            None => "",
        };
        let mode = match mode {
            Some(Mode::Debug) => "Debug",
            Some(Mode::Release) => "Release",
            None => "",
        };
        let edition = match edition {
            None => "",
            Some(None) => "Unspecified",
            Some(Some(Edition::Rust2015)) => "Rust2015",
            Some(Some(Edition::Rust2018)) => "Rust2018",
            Some(Some(Edition::Rust2021)) => "Rust2021",
            Some(Some(Edition::Rust2024)) => "Rust2024",
        };
        let crate_type = match crate_type {
            Some(CrateType::Binary) => "Binary",
            Some(CrateType::Library(_)) => "Library",
            None => "",
        };
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
            cargo_script,
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
            cargo_script,
        } = *self;

        LabelsCore {
            target: Some(target),
            channel: Some(channel),
            mode: Some(mode),
            edition: Some(Some(edition)),
            crate_type: Some(crate_type),
            tests: Some(tests),
            backtrace: Some(backtrace),
            cargo_script: Some(cargo_script),
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
            cargo_script,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel),
            mode: Some(mode),
            edition: Some(Some(edition)),
            crate_type: Some(crate_type),
            tests: Some(tests),
            backtrace: Some(backtrace),
            cargo_script: Some(cargo_script),
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
            cargo_script,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel),
            mode: None,
            edition: Some(Some(edition)),
            crate_type: Some(crate_type),
            tests: None,
            backtrace: None,
            cargo_script: Some(cargo_script),
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
            cargo_script,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel),
            mode: None,
            edition: Some(Some(edition)),
            crate_type: Some(crate_type),
            tests: None,
            backtrace: None,
            cargo_script: Some(cargo_script),
        }
    }
}

impl HasLabelsCore for coordinator::MiriRequest {
    fn labels_core(&self) -> LabelsCore {
        let Self {
            channel,
            crate_type,
            edition,
            code: _,
            cargo_script,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel),
            mode: None,
            edition: Some(Some(edition)),
            crate_type: Some(crate_type),
            tests: None,
            backtrace: None,
            cargo_script: Some(cargo_script),
        }
    }
}

impl HasLabelsCore for coordinator::MacroExpansionRequest {
    fn labels_core(&self) -> LabelsCore {
        let Self {
            channel,
            crate_type,
            edition,
            code: _,
            cargo_script,
        } = *self;

        LabelsCore {
            target: None,
            channel: Some(channel),
            mode: None,
            edition: Some(Some(edition)),
            crate_type: Some(crate_type),
            tests: None,
            backtrace: None,
            cargo_script: Some(cargo_script),
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
