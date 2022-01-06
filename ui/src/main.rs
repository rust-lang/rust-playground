#![deny(rust_2018_idioms)]

use corsware::{AllowedOrigins, CorsMiddleware, UniCase};
use iron::{
    headers::ContentType,
    method::Method::{Get, Post},
    modifiers::Header,
    prelude::*,
    status,
};
use lazy_static::lazy_static;
use mount::Mount;
use playground_middleware::{
    Cache, FileLogger, GuessContentType, ModifyWith, Prefix, Rewrite, Staticfile, StatisticLogger,
};
use prometheus::{Encoder, TextEncoder};
use router::Router;
use serde::{de::DeserializeOwned, Serialize, Deserialize};
use snafu::{ResultExt, Snafu};
use std::{
    any::Any,
    convert::{TryFrom, TryInto},
    env,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use crate::metrics::{track_metric, track_metric_force_endpoint, track_metric_no_request};
use crate::sandbox::Sandbox;

const DEFAULT_ADDRESS: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5000;
const DEFAULT_LOG_FILE: &str = "access-log.csv";

mod asm_cleanup;
mod gist;
mod sandbox;

const ONE_HOUR_IN_SECONDS: u32 = 60 * 60;
const ONE_DAY_IN_SECONDS: u64 = 60 * 60 * 24;
const ONE_YEAR_IN_SECONDS: u64 = 60 * 60 * 24 * 365;

const SANDBOX_CACHE_TIME_TO_LIVE_IN_SECONDS: u64 = ONE_HOUR_IN_SECONDS as u64;

fn main() {
    // Dotenv may be unable to load environment variables, but that's ok in production
    let _ = dotenv::dotenv();
    openssl_probe::init_ssl_cert_env_vars();
    env_logger::init();

    let root: PathBuf = env::var_os("PLAYGROUND_UI_ROOT").expect("Must specify PLAYGROUND_UI_ROOT").into();
    let gh_token = env::var("PLAYGROUND_GITHUB_TOKEN").expect("Must specify PLAYGROUND_GITHUB_TOKEN");

    let address = env::var("PLAYGROUND_UI_ADDRESS").unwrap_or_else(|_| DEFAULT_ADDRESS.to_string());
    let port = env::var("PLAYGROUND_UI_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT);
    let logfile = env::var("PLAYGROUND_LOG_FILE").unwrap_or_else(|_| DEFAULT_LOG_FILE.to_string());
    let cors_enabled = env::var_os("PLAYGROUND_CORS_ENABLED").is_some();
    let metrics_token = env::var("PLAYGROUND_METRICS_TOKEN").ok();

    let files = Staticfile::new(&root).expect("Unable to open root directory");
    let mut files = Chain::new(files);
    let one_day = Duration::new(ONE_DAY_IN_SECONDS, 0);
    let one_year = Duration::new(ONE_YEAR_IN_SECONDS, 0);

    files.link_after(ModifyWith::new(Cache::new(one_day)));
    files.link_after(Prefix::new(&["assets"], Cache::new(one_year)));
    files.link_after(GuessContentType::new(ContentType::html().0));

    let mut gist_router = Router::new();
    gist_router.post("/", meta_gist_create, "gist_create");
    gist_router.get("/:id", meta_gist_get, "gist_get");

    let mut mount = Mount::new();
    mount.mount("/", files);
    mount.mount("/compile", compile);
    mount.mount("/execute", execute);
    mount.mount("/format", format);
    mount.mount("/clippy", clippy);
    mount.mount("/miri", miri);
    mount.mount("/macro-expansion", macro_expansion);
    mount.mount("/meta/crates", meta_crates);
    mount.mount("/meta/version/stable", meta_version_stable);
    mount.mount("/meta/version/beta", meta_version_beta);
    mount.mount("/meta/version/nightly", meta_version_nightly);
    mount.mount("/meta/version/rustfmt", meta_version_rustfmt);
    mount.mount("/meta/version/clippy", meta_version_clippy);
    mount.mount("/meta/version/miri", meta_version_miri);
    mount.mount("/meta/gist", gist_router);
    mount.mount("/evaluate.json", evaluate);
    mount.mount("/wasm-pack", wasm_pack);

    mount.mount("/metrics", metrics);

    let mut chain = Chain::new(mount);
    let file_logger = FileLogger::new(logfile).expect("Unable to create file logger");
    let logger = StatisticLogger::new(file_logger);
    let rewrite = Rewrite::new(vec![vec!["help".into()]], "/index.html".into());
    let gh_token = GhToken::new(gh_token);

    chain.link_around(logger);
    chain.link_before(rewrite);
    chain.link_before(gh_token);

    if let Some(metrics_token) = metrics_token {
        let metrics_token = MetricsToken::new(metrics_token);
        chain.link_before(metrics_token);
    }

    if cors_enabled {
        chain.link_around(CorsMiddleware {
            // A null origin occurs when you make a request from a
            // page hosted on a filesystem, such as when you read the
            // Rust book locally
            allowed_origins: AllowedOrigins::Any { allow_null: true },
            allowed_headers: vec![UniCase("Content-Type".to_owned())],
            allowed_methods: vec![Get, Post],
            exposed_headers: vec![],
            allow_credentials: false,
            max_age_seconds: ONE_HOUR_IN_SECONDS,
            prefer_wildcard: true,
        });
    }

    log::info!("Starting the server on http://{}:{}", address, port);
    Iron::new(chain).http((&*address, port)).expect("Unable to start server");
}

#[derive(Debug, Clone)]
struct GhToken(Arc<String>);

impl GhToken {
    fn new(token: String) -> Self {
        GhToken(Arc::new(token))
    }
}

impl iron::BeforeMiddleware for GhToken {
    fn before(&self, req: &mut Request<'_, '_>) -> IronResult<()> {
        req.extensions.insert::<Self>(self.clone());
        Ok(())
    }
}

impl iron::typemap::Key for GhToken {
    type Value = Self;
}

#[derive(Debug, Clone)]
struct MetricsToken(Arc<String>);

impl MetricsToken {
    fn new(token: String) -> Self {
        MetricsToken(Arc::new(token))
    }
}

impl iron::BeforeMiddleware for MetricsToken {
    fn before(&self, req: &mut Request<'_, '_>) -> IronResult<()> {
        req.extensions.insert::<Self>(self.clone());
        Ok(())
    }
}

impl iron::typemap::Key for MetricsToken {
    type Value = Self;
}

fn compile(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: CompileRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.compile(&req))
            .map(CompileResponse::from)
            .context(Compilation)
    })
}

fn execute(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: ExecuteRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.execute(&req))
            .map(ExecuteResponse::from)
            .context(Execution)
    })
}

fn format(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: FormatRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.format(&req))
            .map(FormatResponse::from)
            .context(Formatting)
    })
}

fn clippy(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: ClippyRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.clippy(&req))
            .map(ClippyResponse::from)
            .context(Linting)
    })
}

fn miri(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: MiriRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.miri(&req))
            .map(MiriResponse::from)
            .context(Interpreting)
    })
}

fn macro_expansion(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: MacroExpansionRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.macro_expansion(&req))
            .map(MacroExpansionResponse::from)
            .context(Expansion)
    })
}

fn meta_crates(_req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        track_metric_no_request(metrics::Endpoint::MetaCrates, || cached(sandbox).crates())
            .map(MetaCratesResponse::from)
    })
}

fn meta_version_stable(_req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        track_metric_no_request(metrics::Endpoint::MetaVersionStable, || {
            cached(sandbox).version_stable()
        })
        .map(MetaVersionResponse::from)
    })
}

fn meta_version_beta(_req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        track_metric_no_request(metrics::Endpoint::MetaVersionBeta, || {
            cached(sandbox).version_beta()
        })
        .map(MetaVersionResponse::from)
    })
}

fn meta_version_nightly(_req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        track_metric_no_request(metrics::Endpoint::MetaVersionNightly, || {
            cached(sandbox).version_nightly()
        })
        .map(MetaVersionResponse::from)
    })
}

fn meta_version_rustfmt(_req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        track_metric_no_request(metrics::Endpoint::MetaVersionRustfmt, || {
            cached(sandbox).version_rustfmt()
        })
        .map(MetaVersionResponse::from)
    })
}

fn meta_version_clippy(_req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        track_metric_no_request(metrics::Endpoint::MetaVersionClippy, || {
            cached(sandbox).version_clippy()
        })
        .map(MetaVersionResponse::from)
    })
}

fn meta_version_miri(_req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        track_metric_no_request(metrics::Endpoint::MetaVersionMiri, || {
            cached(sandbox).version_miri()
        })
        .map(MetaVersionResponse::from)
    })
}

fn meta_gist_create(req: &mut Request<'_, '_>) -> IronResult<Response> {
    let token = req.extensions.get::<GhToken>().unwrap().0.as_ref().clone();
    serialize_to_response(deserialize_from_request(req, |r: MetaGistCreateRequest| {
        let gist = gist::create(token, r.code);
        Ok(MetaGistResponse::from(gist))
    }))
}

fn meta_gist_get(req: &mut Request<'_, '_>) -> IronResult<Response> {
    match req.extensions.get::<Router>().unwrap().find("id") {
        Some(id) => {
            let token = req.extensions.get::<GhToken>().unwrap().0.as_ref().clone();
            let gist = gist::load(token, id);
            serialize_to_response(Ok(MetaGistResponse::from(gist)))
        }
        None => {
            Ok(Response::with(status::UnprocessableEntity))
        }
    }
}

// This is a backwards compatibilty shim. The Rust homepage and the
// documentation use this to run code in place.
fn evaluate(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: EvaluateRequest| {
        let req = req.try_into()?;
        track_metric_force_endpoint(req, metrics::Endpoint::Evaluate, |req| {
            sandbox.execute(&req)
        })
        .map(EvaluateResponse::from)
        .context(Evaluation)
    })
}

fn wasm_pack(req: &mut Request<'_, '_>) -> IronResult<Response>{
    with_sandbox(req, |sandbox, req: WasmPackRequest| {
        let req = req.try_into()?;
        sandbox
            .wasm_pack(&req)
            .map(WasmPackResponse::from)
            .context(WasmPack)
    })
}

fn with_sandbox<Req, Resp, F>(req: &mut Request<'_, '_>, f: F) -> IronResult<Response>
where
    F: FnOnce(Sandbox, Req) -> Result<Resp>,
    Req: DeserializeOwned + Clone + Any + 'static,
    Resp: Serialize,
{
    serialize_to_response(run_handler(req, f))
}

fn with_sandbox_no_request<Resp, F>(f: F) -> IronResult<Response>
where
    F: FnOnce(Sandbox) -> Result<Resp>,
    Resp: Serialize,
{
    serialize_to_response(run_handler_no_request(f))
}

fn run_handler<Req, Resp, F>(req: &mut Request<'_, '_>, f: F) -> Result<Resp>
where
    F: FnOnce(Sandbox, Req) -> Result<Resp>,
    Req: DeserializeOwned + Clone + Any + 'static,
{
    deserialize_from_request(req, |req| {
        let sandbox = Sandbox::new().context(SandboxCreation)?;
        f(sandbox, req)
    })
}

fn deserialize_from_request<Req, Resp, F>(req: &mut Request<'_, '_>, f: F) -> Result<Resp>
where
    F: FnOnce(Req) -> Result<Resp>,
    Req: DeserializeOwned + Clone + Any + 'static,
{
    let body = req.get::<bodyparser::Struct<Req>>()
        .context(Deserialization)?;

    let req = body.ok_or(Error::RequestMissing)?;

    let resp = f(req)?;

    Ok(resp)
}

fn run_handler_no_request<Resp, F>(f: F) -> Result<Resp>
where
    F: FnOnce(Sandbox) -> Result<Resp>,
{
    let sandbox = Sandbox::new().context(SandboxCreation)?;
    let resp = f(sandbox)?;
    Ok(resp)
}

fn serialize_to_response<Resp>(response: Result<Resp>) -> IronResult<Response>
where
    Resp: Serialize,
{
    let response = response.and_then(|resp| {
        let resp = serde_json::ser::to_string(&resp).context(Serialization)?;
        Ok(resp)
    });

    match response {
        Ok(body) => Ok(Response::with((status::Ok, Header(ContentType::json()), body))),
        Err(err) => {
            let err = ErrorJson { error: err.to_string() };
            match serde_json::ser::to_string(&err) {
                Ok(error_str) => Ok(Response::with((status::InternalServerError, Header(ContentType::json()), error_str))),
                Err(_) => Ok(Response::with((status::InternalServerError, Header(ContentType::json()), FATAL_ERROR_JSON))),
            }
        },
    }
}

#[derive(Debug, Clone)]
struct SandboxCacheInfo<T> {
    value: T,
    time: Instant,
}

/// Caches the success value of a single operation
#[derive(Debug)]
struct SandboxCacheOne<T>(Mutex<Option<SandboxCacheInfo<T>>>);

impl<T> Default for SandboxCacheOne<T> {
    fn default() -> Self { SandboxCacheOne(Mutex::default()) }
}

impl<T> SandboxCacheOne<T>
where
    T: Clone
{
    fn clone_or_populate<F>(&self, populator: F) -> Result<T>
    where
        F: FnOnce() -> sandbox::Result<T>
    {
        let mut cache = self.0.lock().map_err(|_| Error::CachePoisoned)?;

        match cache.clone() {
            Some(cached) => {
                if cached.time.elapsed() > Duration::from_secs(SANDBOX_CACHE_TIME_TO_LIVE_IN_SECONDS) {
                    SandboxCacheOne::populate(&mut *cache, populator)
                } else {
                    Ok(cached.value)
                }
            },
            None => {
                SandboxCacheOne::populate(&mut *cache, populator)
            }
        }
    }

    fn populate<F>(cache: &mut Option<SandboxCacheInfo<T>>, populator: F) -> Result<T>
    where
        F: FnOnce() -> sandbox::Result<T>
    {
        let value = populator().context(Caching)?;
        *cache = Some(SandboxCacheInfo {
            value: value.clone(),
            time: Instant::now(),
        });
        Ok(value)
    }
}

/// Caches the successful results of all sandbox operations that make
/// sense to cache.
#[derive(Debug, Default)]
struct SandboxCache {
    crates: SandboxCacheOne<Vec<sandbox::CrateInformation>>,
    version_stable: SandboxCacheOne<sandbox::Version>,
    version_beta: SandboxCacheOne<sandbox::Version>,
    version_nightly: SandboxCacheOne<sandbox::Version>,
    version_clippy: SandboxCacheOne<sandbox::Version>,
    version_rustfmt: SandboxCacheOne<sandbox::Version>,
    version_miri: SandboxCacheOne<sandbox::Version>,
}

/// Provides a similar API to the Sandbox that caches the successful results.
struct CachedSandbox<'a> {
    sandbox: Sandbox,
    cache: &'a SandboxCache,
}

impl<'a> CachedSandbox<'a> {
    fn crates(&self) -> Result<Vec<sandbox::CrateInformation>> {
        self.cache.crates.clone_or_populate(|| self.sandbox.crates())
    }

    fn version_stable(&self) -> Result<sandbox::Version> {
        self.cache.version_stable.clone_or_populate(|| {
            self.sandbox.version(sandbox::Channel::Stable)
        })
    }

    fn version_beta(&self) -> Result<sandbox::Version> {
        self.cache.version_beta.clone_or_populate(|| {
            self.sandbox.version(sandbox::Channel::Beta)
        })
    }

    fn version_nightly(&self) -> Result<sandbox::Version> {
        self.cache.version_nightly.clone_or_populate(|| {
            self.sandbox.version(sandbox::Channel::Nightly)
        })
    }

    fn version_clippy(&self) -> Result<sandbox::Version> {
        self.cache.version_clippy.clone_or_populate(|| {
            self.sandbox.version_clippy()
        })
    }

    fn version_rustfmt(&self) -> Result<sandbox::Version> {
        self.cache.version_rustfmt.clone_or_populate(|| {
            self.sandbox.version_rustfmt()
        })
    }

    fn version_miri(&self) -> Result<sandbox::Version> {
        self.cache.version_miri.clone_or_populate(|| {
            self.sandbox.version_miri()
        })
    }
}

/// A convenience constructor
fn cached(sandbox: Sandbox) -> CachedSandbox<'static> {
    lazy_static! {
        static ref SANDBOX_CACHE: SandboxCache = Default::default();
    }

    CachedSandbox {
        sandbox,
        cache: &SANDBOX_CACHE,
    }
}

mod metrics {
    use lazy_static::lazy_static;
    use prometheus::{self, register_histogram_vec, HistogramVec};
    use regex::Regex;
    use std::time::Instant;

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

        fn to_values(&self) -> [&'static str; Self::COUNT] {
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

    pub(crate) fn track_metric<Req, B, Resp>(request: Req, body: B) -> sandbox::Result<Resp>
    where
        Req: GenerateLabels,
        B: FnOnce(&Req) -> sandbox::Result<Resp>,
        Resp: SuccessDetails,
    {
        track_metric_common(request, body, |_| {})
    }

    pub(crate) fn track_metric_force_endpoint<Req, B, Resp>(
        request: Req,
        endpoint: Endpoint,
        body: B,
    ) -> sandbox::Result<Resp>
    where
        Req: GenerateLabels,
        B: FnOnce(&Req) -> sandbox::Result<Resp>,
        Resp: SuccessDetails,
    {
        track_metric_common(request, body, |labels| labels.endpoint = endpoint)
    }

    fn track_metric_common<Req, B, Resp, F>(request: Req, body: B, f: F) -> sandbox::Result<Resp>
    where
        Req: GenerateLabels,
        B: FnOnce(&Req) -> sandbox::Result<Resp>,
        Resp: SuccessDetails,
        F: FnOnce(&mut Labels),
    {
        let start = Instant::now();
        let response = body(&request);
        let elapsed = start.elapsed();

        let outcome = SuccessDetails::for_sandbox_result(&response);
        let mut labels = request.generate_labels(outcome);
        f(&mut labels);
        let values = &labels.to_values();

        let histogram = REQUESTS.with_label_values(values);

        histogram.observe(elapsed.as_secs_f64());

        response
    }

    pub(crate) fn track_metric_no_request<B, Resp>(
        endpoint: Endpoint,
        body: B,
    ) -> crate::Result<Resp>
    where
        B: FnOnce() -> crate::Result<Resp>,
    {
        let start = Instant::now();
        let response = body();
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
        let values = &labels.to_values();
        let histogram = REQUESTS.with_label_values(values);

        histogram.observe(elapsed.as_secs_f64());

        response
    }
}

fn authorized_for_metrics(req: &mut Request<'_, '_>) -> bool {
    use iron::headers::{Authorization, Bearer};

    // If not configured, allow it to be public
    let token = match req.extensions.get::<MetricsToken>() {
        Some(token) => token,
        None => return true,
    };

    let authorization = match req.headers.get::<Authorization<Bearer>>() {
        Some(a) => a,
        None => return false,
    };

    authorization.0.token.as_str() == token.0.as_str()
}

fn metrics(req: &mut Request<'_, '_>) -> IronResult<Response> {
    if !authorized_for_metrics(req) {
        return Ok(Response::with((status::Unauthorized, "Unauthorized")));
    }

    let metric_families = prometheus::gather();
    let encoder = TextEncoder::new();
    let mut buffer = Vec::new();

    encoder.encode(&metric_families, &mut buffer).unwrap();

    Ok(Response::with((status::Ok, buffer)))
}

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Sandbox creation failed: {}", source))]
    SandboxCreation { source: sandbox::Error },
    #[snafu(display("Compilation operation failed: {}", source))]
    Compilation { source: sandbox::Error },
    #[snafu(display("Execution operation failed: {}", source))]
    Execution { source: sandbox::Error },
    #[snafu(display("Evaluation operation failed: {}", source))]
    Evaluation { source: sandbox::Error },
    #[snafu(display("wasm-pack operation failed: {}", source))]
    WasmPack { source: sandbox::Error },
    #[snafu(display("Linting operation failed: {}", source))]
    Linting { source: sandbox::Error },
    #[snafu(display("Expansion operation failed: {}", source))]
    Expansion { source: sandbox::Error },
    #[snafu(display("Formatting operation failed: {}", source))]
    Formatting { source: sandbox::Error },
    #[snafu(display("Interpreting operation failed: {}", source))]
    Interpreting { source: sandbox::Error },
    #[snafu(display("Caching operation failed: {}", source))]
    Caching { source: sandbox::Error },
    #[snafu(display("Unable to serialize response: {}", source))]
    Serialization { source: serde_json::Error },
    #[snafu(display("Unable to deserialize request: {}", source))]
    Deserialization { source: bodyparser::BodyError },
    #[snafu(display("The value {:?} is not a valid target", value))]
    InvalidTarget { value: String },
    #[snafu(display("The value {:?} is not a valid assembly flavor", value))]
    InvalidAssemblyFlavor { value: String },
    #[snafu(display("The value {:?} is not a valid demangle option", value))]
    InvalidDemangleAssembly { value: String },
    #[snafu(display("The value {:?} is not a valid assembly processing option", value))]
    InvalidProcessAssembly { value: String },
    #[snafu(display("The value {:?} is not a valid channel", value,))]
    InvalidChannel { value: String },
    #[snafu(display("The value {:?} is not a valid mode", value))]
    InvalidMode { value: String },
    #[snafu(display("The value {:?} is not a valid edition", value))]
    InvalidEdition { value: String },
    #[snafu(display("The value {:?} is not a valid crate type", value))]
    InvalidCrateType { value: String },
    #[snafu(display("No request was provided"))]
    RequestMissing,
    #[snafu(display("The cache has been poisoned"))]
    CachePoisoned,
}

type Result<T, E = Error> = ::std::result::Result<T, E>;

const FATAL_ERROR_JSON: &str =
    r#"{"error": "Multiple cascading errors occurred, abandon all hope"}"#;

#[derive(Debug, Clone, Serialize)]
struct ErrorJson {
    error: String,
}

#[derive(Debug, Clone, Deserialize)]
struct CompileRequest {
    target: String,
    #[serde(rename = "assemblyFlavor")]
    assembly_flavor: Option<String>,
    #[serde(rename = "demangleAssembly")]
    demangle_assembly: Option<String>,
    #[serde(rename = "processAssembly")]
    process_assembly: Option<String>,
    channel: String,
    mode: String,
    #[serde(default)]
    edition: String,
    #[serde(rename = "crateType")]
    crate_type: String,
    tests: bool,
    #[serde(default)]
    backtrace: bool,
    code: String,
}

#[derive(Debug, Clone, Serialize)]
struct CompileResponse {
    success: bool,
    code: String,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ExecuteRequest {
    channel: String,
    mode: String,
    #[serde(default)]
    edition: String,
    #[serde(rename = "crateType")]
    crate_type: String,
    tests: bool,
    #[serde(default)]
    backtrace: bool,
    code: String,
}

#[derive(Debug, Clone, Serialize)]
struct ExecuteResponse {
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Deserialize)]
struct FormatRequest {
    code: String,
    #[serde(default)]
    edition: String,
}

#[derive(Debug, Clone, Serialize)]
struct FormatResponse {
    success: bool,
    code: String,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ClippyRequest {
    code: String,
    #[serde(default)]
    edition: String,
    #[serde(default = "default_crate_type", rename = "crateType")]
    crate_type: String,
}

#[derive(Debug, Clone, Serialize)]
struct ClippyResponse {
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Deserialize)]
struct MiriRequest {
    code: String,
    #[serde(default)]
    edition: String,
}

#[derive(Debug, Clone, Serialize)]
struct MiriResponse {
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Deserialize)]
struct MacroExpansionRequest {
    code: String,
    #[serde(default)]
    edition: String,
}

#[derive(Debug, Clone, Serialize)]
struct MacroExpansionResponse {
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Serialize)]
struct CrateInformation {
    name: String,
    version: String,
    id: String,
}

#[derive(Debug, Clone, Serialize)]
struct MetaCratesResponse {
    crates: Vec<CrateInformation>,
}

#[derive(Debug, Clone, Serialize)]
struct MetaVersionResponse {
    version: String,
    hash: String,
    date: String,
}

#[derive(Debug, Clone, Deserialize)]
struct MetaGistCreateRequest {
    code: String,
}

#[derive(Debug, Clone, Serialize)]
struct MetaGistResponse {
    id: String,
    url: String,
    code: String,
}

#[derive(Debug, Clone, Deserialize)]
struct EvaluateRequest {
    version: String,
    optimize: String,
    code: String,
    #[serde(default)]
    edition: String,
    #[serde(default)]
    tests: bool,
}

#[derive(Debug, Clone, Serialize)]
struct EvaluateResponse {
    result: String,
    error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct WasmPackRequest {
    code: String
}

#[derive(Debug, Clone, Serialize)]
struct WasmPackResponse {
    success: bool,
    wasm_js: String,
    wasm_bg: String,
    stdout: String,
    stderr: String,
}

impl TryFrom<CompileRequest> for sandbox::CompileRequest {
    type Error = Error;

    fn try_from(me: CompileRequest) -> Result<Self> {
        let target = parse_target(&me.target)?;
        let assembly_flavor = match me.assembly_flavor {
            Some(f) => Some(parse_assembly_flavor(&f)?),
            None => None,
        };

        let demangle = match me.demangle_assembly {
            Some(f) => Some(parse_demangle_assembly(&f)?),
            None => None,
        };

        let process_assembly = match me.process_assembly {
            Some(f) => Some(parse_process_assembly(&f)?),
            None => None,
        };

        let target = match (target, assembly_flavor, demangle, process_assembly) {
            (sandbox::CompileTarget::Assembly(_, _, _), Some(flavor), Some(demangle), Some(process)) =>
                sandbox::CompileTarget::Assembly(flavor, demangle, process),
            _ => target,
        };

        Ok(sandbox::CompileRequest {
            target,
            channel: parse_channel(&me.channel)?,
            mode: parse_mode(&me.mode)?,
            edition: parse_edition(&me.edition)?,
            crate_type: parse_crate_type(&me.crate_type)?,
            tests: me.tests,
            backtrace: me.backtrace,
            code: me.code,
        })
    }
}

impl From<sandbox::CompileResponse> for CompileResponse {
    fn from(me: sandbox::CompileResponse) -> Self {
        CompileResponse {
            success: me.success,
            code: me.code,
            stdout: me.stdout,
            stderr: me.stderr,
        }
    }
}

impl TryFrom<ExecuteRequest> for sandbox::ExecuteRequest {
    type Error = Error;

    fn try_from(me: ExecuteRequest) -> Result<Self> {
        Ok(sandbox::ExecuteRequest {
            channel: parse_channel(&me.channel)?,
            mode: parse_mode(&me.mode)?,
            edition: parse_edition(&me.edition)?,
            crate_type: parse_crate_type(&me.crate_type)?,
            tests: me.tests,
            backtrace: me.backtrace,
            code: me.code,
        })
    }
}

impl From<sandbox::ExecuteResponse> for ExecuteResponse {
    fn from(me: sandbox::ExecuteResponse) -> Self {
        ExecuteResponse {
            success: me.success,
            stdout: me.stdout,
            stderr: me.stderr,
        }
    }
}

impl TryFrom<FormatRequest> for sandbox::FormatRequest {
    type Error = Error;

    fn try_from(me: FormatRequest) -> Result<Self> {
        Ok(sandbox::FormatRequest {
            code: me.code,
            edition: parse_edition(&me.edition)?,
        })
    }
}

impl From<sandbox::FormatResponse> for FormatResponse {
    fn from(me: sandbox::FormatResponse) -> Self {
        FormatResponse {
            success: me.success,
            code: me.code,
            stdout: me.stdout,
            stderr: me.stderr,
        }
    }
}

impl TryFrom<ClippyRequest> for sandbox::ClippyRequest {
    type Error = Error;

    fn try_from(me: ClippyRequest) -> Result<Self> {
        Ok(sandbox::ClippyRequest {
            code: me.code,
            crate_type: parse_crate_type(&me.crate_type)?,
            edition: parse_edition(&me.edition)?,
        })
    }
}

impl From<sandbox::ClippyResponse> for ClippyResponse {
    fn from(me: sandbox::ClippyResponse) -> Self {
        ClippyResponse {
            success: me.success,
            stdout: me.stdout,
            stderr: me.stderr,
        }
    }
}

impl TryFrom<MiriRequest> for sandbox::MiriRequest {
    type Error = Error;

    fn try_from(me: MiriRequest) -> Result<Self> {
        Ok(sandbox::MiriRequest {
            code: me.code,
            edition: parse_edition(&me.edition)?,
        })
    }
}

impl From<sandbox::MiriResponse> for MiriResponse {
    fn from(me: sandbox::MiriResponse) -> Self {
        MiriResponse {
            success: me.success,
            stdout: me.stdout,
            stderr: me.stderr,
        }
    }
}

impl TryFrom<MacroExpansionRequest> for sandbox::MacroExpansionRequest {
    type Error = Error;

    fn try_from(me: MacroExpansionRequest) -> Result<Self> {
        Ok(sandbox::MacroExpansionRequest {
            code: me.code,
            edition: parse_edition(&me.edition)?,
        })
    }
}

impl From<sandbox::MacroExpansionResponse> for MacroExpansionResponse {
    fn from(me: sandbox::MacroExpansionResponse) -> Self {
        MacroExpansionResponse {
            success: me.success,
            stdout: me.stdout,
            stderr: me.stderr,
        }
    }
}

impl From<Vec<sandbox::CrateInformation>> for MetaCratesResponse {
    fn from(me: Vec<sandbox::CrateInformation>) -> Self {
        let crates = me.into_iter()
            .map(|cv| CrateInformation { name: cv.name, version: cv.version, id: cv.id })
            .collect();

        MetaCratesResponse {
            crates,
        }
    }
}

impl From<sandbox::Version> for MetaVersionResponse {
    fn from(me: sandbox::Version) -> Self {
        MetaVersionResponse {
            version: me.release,
            hash: me.commit_hash,
            date: me.commit_date,
        }
    }
}

impl From<gist::Gist> for MetaGistResponse {
    fn from(me: gist::Gist) -> Self {
        MetaGistResponse {
            id: me.id,
            url: me.url,
            code: me.code,
        }
    }
}

impl TryFrom<EvaluateRequest> for sandbox::ExecuteRequest {
    type Error = Error;

    fn try_from(me: EvaluateRequest) -> Result<Self> {
        Ok(sandbox::ExecuteRequest {
            channel: parse_channel(&me.version)?,
            mode: if me.optimize != "0" { sandbox::Mode::Release } else { sandbox::Mode::Debug },
            edition: parse_edition(&me.edition)?,
            crate_type: sandbox::CrateType::Binary,
            tests: me.tests,
            backtrace: false,
            code: me.code,
        })
    }
}

impl From<sandbox::ExecuteResponse> for EvaluateResponse {
    fn from(me: sandbox::ExecuteResponse) -> Self {
        // The old playground didn't use Cargo, so it never had the
        // Cargo output ("Compiling playground...") which is printed
        // to stderr. Since this endpoint is used to inline results on
        // the page, don't include the stderr unless an error
        // occurred.
        if me.success {
            EvaluateResponse {
                result: me.stdout,
                error: None,
            }
        } else {
            // When an error occurs, *some* consumers check for an
            // `error` key, others assume that the error is crammed in
            // the `result` field and then they string search for
            // `error:` or `warning:`. Ew. We can put it in both.
            let result = me.stderr + &me.stdout;
            EvaluateResponse {
                result: result.clone(),
                error: Some(result),
            }
        }
    }
}

impl TryFrom<WasmPackRequest> for sandbox::WasmPackRequest {
    type Error = Error;

    fn try_from(me: WasmPackRequest) -> Result<Self> {
        Ok(sandbox::WasmPackRequest {
            code: me.code,
            ..sandbox::WasmPackRequest::default()
        })
    }
}

impl From<sandbox::WasmPackResponse> for WasmPackResponse {
    fn from(me: sandbox::WasmPackResponse) -> Self {
        WasmPackResponse {
            success: me.success,
            wasm_bg: me.wasm_bg,
            wasm_js: me.wasm_js,
            stdout: me.stdout,
            stderr: me.stderr,
        }
    }
}

fn parse_target(s: &str) -> Result<sandbox::CompileTarget> {
    Ok(match s {
        "asm" => sandbox::CompileTarget::Assembly(sandbox::AssemblyFlavor::Att,
                                                  sandbox::DemangleAssembly::Demangle,
                                                  sandbox::ProcessAssembly::Filter),
        "llvm-ir" => sandbox::CompileTarget::LlvmIr,
        "mir" => sandbox::CompileTarget::Mir,
        "hir" => sandbox::CompileTarget::Hir,
        "wasm" => sandbox::CompileTarget::Wasm,
        value => InvalidTarget { value }.fail()?,
    })
}

fn parse_assembly_flavor(s: &str) -> Result<sandbox::AssemblyFlavor> {
    Ok(match s {
        "att" => sandbox::AssemblyFlavor::Att,
        "intel" => sandbox::AssemblyFlavor::Intel,
        value => InvalidAssemblyFlavor { value }.fail()?
    })
}

fn parse_demangle_assembly(s: &str) -> Result<sandbox::DemangleAssembly> {
    Ok(match s {
        "demangle" => sandbox::DemangleAssembly::Demangle,
        "mangle" => sandbox::DemangleAssembly::Mangle,
        value => InvalidDemangleAssembly { value }.fail()?,
    })
}

fn parse_process_assembly(s: &str) -> Result<sandbox::ProcessAssembly> {
    Ok(match s {
        "filter" => sandbox::ProcessAssembly::Filter,
        "raw" => sandbox::ProcessAssembly::Raw,
        value => InvalidProcessAssembly { value }.fail()?
    })
}

fn parse_channel(s: &str) -> Result<sandbox::Channel> {
    Ok(match s {
        "stable" => sandbox::Channel::Stable,
        "beta" => sandbox::Channel::Beta,
        "nightly" => sandbox::Channel::Nightly,
        value => InvalidChannel { value }.fail()?,
    })
}

fn parse_mode(s: &str) -> Result<sandbox::Mode> {
    Ok(match s {
        "debug" => sandbox::Mode::Debug,
        "release" => sandbox::Mode::Release,
        value => InvalidMode { value }.fail()?,
    })
}

fn parse_edition(s: &str) -> Result<Option<sandbox::Edition>> {
    Ok(match s {
        "" => None,
        "2015" => Some(sandbox::Edition::Rust2015),
        "2018" => Some(sandbox::Edition::Rust2018),
        "2021" => Some(sandbox::Edition::Rust2021),
        value => InvalidEdition { value }.fail()?,
    })
}

fn parse_crate_type(s: &str) -> Result<sandbox::CrateType> {
    use crate::sandbox::{CrateType::*, LibraryType::*};
    Ok(match s {
        "bin" => Binary,
        "lib" => Library(Lib),
        "dylib" => Library(Dylib),
        "rlib" => Library(Rlib),
        "staticlib" => Library(Staticlib),
        "cdylib" => Library(Cdylib),
        "proc-macro" => Library(ProcMacro),
        value => InvalidCrateType { value }.fail()?,
    })
}

fn default_crate_type() -> String {
    "bin".into()
}
