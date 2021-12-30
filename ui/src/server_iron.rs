use crate::{
    gist,
    metrics::{self, track_metric, track_metric_force_endpoint, track_metric_no_request},
    sandbox::{self, Sandbox},
    CachingSnafu, ClippyRequest, ClippyResponse, CompilationSnafu, CompileRequest, CompileResponse,
    Config, DeserializationSnafu, Error, ErrorJson, EvaluateRequest, EvaluateResponse,
    EvaluationSnafu, ExecuteRequest, ExecuteResponse, ExecutionSnafu, ExpansionSnafu,
    FormatRequest, FormatResponse, FormattingSnafu, GhToken, InterpretingSnafu, LintingSnafu,
    MacroExpansionRequest, MacroExpansionResponse, MetaCratesResponse, MetaGistCreateRequest,
    MetaGistResponse, MetaVersionResponse, MetricsToken, MiriRequest, MiriResponse, Result,
    SandboxCreationSnafu, SerializationSnafu, FATAL_ERROR_JSON, ONE_DAY, ONE_HOUR_IN_SECONDS,
    ONE_YEAR, SANDBOX_CACHE_TIME_TO_LIVE,
};
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
use serde::{de::DeserializeOwned, Serialize};
use snafu::ResultExt;
use std::{any::Any, convert::TryInto, sync::Mutex, time::Instant};

pub(crate) fn serve(config: Config) {
    let Config {
        root,
        gh_token,
        address,
        port,
        logfile,
        cors_enabled,
        metrics_token,
        axum_enabled: _,
    } = config;

    let files = Staticfile::new(&root).expect("Unable to open root directory");
    let mut files = Chain::new(files);

    files.link_after(ModifyWith::new(Cache::new(ONE_DAY)));
    files.link_after(Prefix::new(&["assets"], Cache::new(ONE_YEAR)));
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
    Iron::new(chain)
        .http((&*address, port))
        .expect("Unable to start server");
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
            .context(CompilationSnafu)
    })
}

fn execute(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: ExecuteRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.execute(&req))
            .map(ExecuteResponse::from)
            .context(ExecutionSnafu)
    })
}

fn format(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: FormatRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.format(&req))
            .map(FormatResponse::from)
            .context(FormattingSnafu)
    })
}

fn clippy(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: ClippyRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.clippy(&req))
            .map(ClippyResponse::from)
            .context(LintingSnafu)
    })
}

fn miri(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: MiriRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.miri(&req))
            .map(MiriResponse::from)
            .context(InterpretingSnafu)
    })
}

fn macro_expansion(req: &mut Request<'_, '_>) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: MacroExpansionRequest| {
        let req = req.try_into()?;
        track_metric(req, |req| sandbox.macro_expansion(&req))
            .map(MacroExpansionResponse::from)
            .context(ExpansionSnafu)
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
        None => Ok(Response::with(status::UnprocessableEntity)),
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
        .context(EvaluationSnafu)
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
        let sandbox = Sandbox::new().context(SandboxCreationSnafu)?;
        f(sandbox, req)
    })
}

fn deserialize_from_request<Req, Resp, F>(req: &mut Request<'_, '_>, f: F) -> Result<Resp>
where
    F: FnOnce(Req) -> Result<Resp>,
    Req: DeserializeOwned + Clone + Any + 'static,
{
    let body = req
        .get::<bodyparser::Struct<Req>>()
        .context(DeserializationSnafu)?;

    let req = body.ok_or(Error::RequestMissing)?;

    let resp = f(req)?;

    Ok(resp)
}

fn run_handler_no_request<Resp, F>(f: F) -> Result<Resp>
where
    F: FnOnce(Sandbox) -> Result<Resp>,
{
    let sandbox = Sandbox::new().context(SandboxCreationSnafu)?;
    let resp = f(sandbox)?;
    Ok(resp)
}

fn serialize_to_response<Resp>(response: Result<Resp>) -> IronResult<Response>
where
    Resp: Serialize,
{
    let response = response.and_then(|resp| {
        let resp = serde_json::ser::to_string(&resp).context(SerializationSnafu)?;
        Ok(resp)
    });

    match response {
        Ok(body) => Ok(Response::with((
            status::Ok,
            Header(ContentType::json()),
            body,
        ))),
        Err(err) => {
            let err = ErrorJson {
                error: err.to_string(),
            };
            match serde_json::ser::to_string(&err) {
                Ok(error_str) => Ok(Response::with((
                    status::InternalServerError,
                    Header(ContentType::json()),
                    error_str,
                ))),
                Err(_) => Ok(Response::with((
                    status::InternalServerError,
                    Header(ContentType::json()),
                    FATAL_ERROR_JSON,
                ))),
            }
        }
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
    fn default() -> Self {
        SandboxCacheOne(Mutex::default())
    }
}

impl<T> SandboxCacheOne<T>
where
    T: Clone,
{
    fn clone_or_populate<F>(&self, populator: F) -> Result<T>
    where
        F: FnOnce() -> sandbox::Result<T>,
    {
        let mut cache = self.0.lock().map_err(|_| Error::CachePoisoned)?;

        match cache.clone() {
            Some(cached) => {
                if cached.time.elapsed() > SANDBOX_CACHE_TIME_TO_LIVE {
                    SandboxCacheOne::populate(&mut *cache, populator)
                } else {
                    Ok(cached.value)
                }
            }
            None => SandboxCacheOne::populate(&mut *cache, populator),
        }
    }

    fn populate<F>(cache: &mut Option<SandboxCacheInfo<T>>, populator: F) -> Result<T>
    where
        F: FnOnce() -> sandbox::Result<T>,
    {
        let value = populator().context(CachingSnafu)?;
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
        self.cache
            .crates
            .clone_or_populate(|| self.sandbox.crates())
    }

    fn version_stable(&self) -> Result<sandbox::Version> {
        self.cache
            .version_stable
            .clone_or_populate(|| self.sandbox.version(sandbox::Channel::Stable))
    }

    fn version_beta(&self) -> Result<sandbox::Version> {
        self.cache
            .version_beta
            .clone_or_populate(|| self.sandbox.version(sandbox::Channel::Beta))
    }

    fn version_nightly(&self) -> Result<sandbox::Version> {
        self.cache
            .version_nightly
            .clone_or_populate(|| self.sandbox.version(sandbox::Channel::Nightly))
    }

    fn version_clippy(&self) -> Result<sandbox::Version> {
        self.cache
            .version_clippy
            .clone_or_populate(|| self.sandbox.version_clippy())
    }

    fn version_rustfmt(&self) -> Result<sandbox::Version> {
        self.cache
            .version_rustfmt
            .clone_or_populate(|| self.sandbox.version_rustfmt())
    }

    fn version_miri(&self) -> Result<sandbox::Version> {
        self.cache
            .version_miri
            .clone_or_populate(|| self.sandbox.version_miri())
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
