use futures::future::BoxFuture;
use lazy_static::lazy_static;
use prometheus::{self, register_histogram_vec, HistogramVec};
use regex::Regex;
use std::{future::Future, time::Instant};

use crate::sandbox::{self, Channel, CompileTarget, CrateType, Edition, Mode};

lazy_static! {
    pub(crate) static ref REQUESTS: HistogramVec = register_histogram_vec!(
        "playground_request_duration_seconds",
        "Number of requests made",
        Labels::LABELS,
        vec![0.1, 1.0, 2.5, 5.0, 10.0, 15.0]
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

impl GenerateLabels for sandbox::CompileRequest {
    fn generate_labels(&self, outcome: Outcome) -> Labels {
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

        Labels {
            endpoint: Endpoint::Compile,
            outcome,

            target: Some(target),
            channel: Some(channel),
            mode: Some(mode),
            edition: Some(edition),
            crate_type: Some(crate_type),
            tests: Some(tests),
            backtrace: Some(backtrace),
        }
    }
}

impl GenerateLabels for sandbox::ExecuteRequest {
    fn generate_labels(&self, outcome: Outcome) -> Labels {
        let Self {
            channel,
            mode,
            edition,
            crate_type,
            tests,
            backtrace,
            code: _,
        } = *self;

        Labels {
            endpoint: Endpoint::Execute,
            outcome,

            target: None,
            channel: Some(channel),
            mode: Some(mode),
            edition: Some(edition),
            crate_type: Some(crate_type),
            tests: Some(tests),
            backtrace: Some(backtrace),
        }
    }
}

impl GenerateLabels for sandbox::FormatRequest {
    fn generate_labels(&self, outcome: Outcome) -> Labels {
        let Self { edition, code: _ } = *self;

        Labels {
            endpoint: Endpoint::Format,
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

impl GenerateLabels for sandbox::ClippyRequest {
    fn generate_labels(&self, outcome: Outcome) -> Labels {
        let Self {
            code: _,
            edition,
            crate_type,
        } = *self;

        Labels {
            endpoint: Endpoint::Clippy,
            outcome,

            target: None,
            channel: None,
            mode: None,
            edition: Some(edition),
            crate_type: Some(crate_type),
            tests: None,
            backtrace: None,
        }
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

impl SuccessDetails for sandbox::CompileResponse {
    fn success_details(&self) -> Outcome {
        common_success_details(self.success, &self.stderr)
    }
}

impl SuccessDetails for sandbox::ExecuteResponse {
    fn success_details(&self) -> Outcome {
        common_success_details(self.success, &self.stderr)
    }
}

impl SuccessDetails for sandbox::FormatResponse {
    fn success_details(&self) -> Outcome {
        common_success_details(self.success, &self.stderr)
    }
}

impl SuccessDetails for sandbox::ClippyResponse {
    fn success_details(&self) -> Outcome {
        common_success_details(self.success, &self.stderr)
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

pub(crate) async fn track_metric_force_endpoint_async<Req, B, Resp>(
    request: Req,
    endpoint: Endpoint,
    body: B,
) -> sandbox::Result<Resp>
where
    Req: GenerateLabels,
    for<'req> B: FnOnce(&'req Req) -> BoxFuture<'req, sandbox::Result<Resp>>,
    Resp: SuccessDetails,
{
    track_metric_common_async(request, body, |labels| labels.endpoint = endpoint).await
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
    let values = &labels.as_values();

    let histogram = REQUESTS.with_label_values(values);

    histogram.observe(elapsed.as_secs_f64());

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
    let values = &labels.as_values();
    let histogram = REQUESTS.with_label_values(values);

    histogram.observe(elapsed.as_secs_f64());

    response
}
