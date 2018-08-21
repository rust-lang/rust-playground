#![feature(try_from)]

#[macro_use]
extern crate log;
extern crate env_logger;
extern crate dotenv;
extern crate iron;
extern crate mount;
extern crate router;
extern crate playground_middleware;
extern crate bodyparser;
extern crate serde;
extern crate serde_json;
#[macro_use]
extern crate serde_derive;
extern crate mktemp;
#[macro_use]
extern crate quick_error;
extern crate corsware;
#[macro_use]
extern crate lazy_static;
extern crate petgraph;
extern crate regex;
extern crate rustc_demangle;
extern crate hubcaps;
extern crate tokio;
extern crate hyper;
extern crate hyper_tls;
extern crate openssl_probe;

use std::any::Any;
use std::convert::{TryFrom, TryInto};
use std::env;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use corsware::{CorsMiddleware, AllowedOrigins, UniCase};
use iron::headers::ContentType;
use iron::method::Method::{Get, Post};
use iron::modifiers::Header;
use iron::prelude::*;
use iron::status;
use mount::Mount;
use playground_middleware::{
    Staticfile, Cache, Prefix, ModifyWith, GuessContentType, FileLogger, StatisticLogger, Rewrite
};
use router::Router;

use serde::Serialize;
use serde::de::DeserializeOwned;

use sandbox::Sandbox;

const DEFAULT_ADDRESS: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5000;
const DEFAULT_LOG_FILE: &str = "access-log.csv";

mod sandbox;
mod asm_cleanup;
mod gist;

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
    mount.mount("/meta/crates", meta_crates);
    mount.mount("/meta/version/stable", meta_version_stable);
    mount.mount("/meta/version/beta", meta_version_beta);
    mount.mount("/meta/version/nightly", meta_version_nightly);
    mount.mount("/meta/version/rustfmt", meta_version_rustfmt);
    mount.mount("/meta/version/clippy", meta_version_clippy);
    mount.mount("/meta/version/miri", meta_version_miri);
    mount.mount("/meta/gist", gist_router);
    mount.mount("/evaluate.json", evaluate);

    let mut chain = Chain::new(mount);
    let file_logger = FileLogger::new(logfile).expect("Unable to create file logger");
    let logger = StatisticLogger::new(file_logger);
    let rewrite = Rewrite::new(vec![vec!["help".into()]], "/index.html".into());
    let gh_token = GhToken::new(gh_token);

    chain.link_around(logger);
    chain.link_before(rewrite);
    chain.link_before(gh_token);

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

    info!("Starting the server on http://{}:{}", address, port);
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
    fn before(&self, req: &mut Request) -> IronResult<()> {
        req.extensions.insert::<Self>(self.clone());
        Ok(())
    }
}

impl iron::typemap::Key for GhToken {
    type Value = Self;
}

fn compile(req: &mut Request) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: CompileRequest| {
        let req = try!(req.try_into());
        sandbox
            .compile(&req)
            .map(CompileResponse::from)
            .map_err(Error::Sandbox)
    })
}

fn execute(req: &mut Request) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: ExecuteRequest| {
        let req = try!(req.try_into());
        sandbox
            .execute(&req)
            .map(ExecuteResponse::from)
            .map_err(Error::Sandbox)
    })
}

fn format(req: &mut Request) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: FormatRequest| {
        let req = try!(req.try_into());
        sandbox
            .format(&req)
            .map(FormatResponse::from)
            .map_err(Error::Sandbox)
    })
}

fn clippy(req: &mut Request) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: ClippyRequest| {
        sandbox
            .clippy(&req.into())
            .map(ClippyResponse::from)
            .map_err(Error::Sandbox)
    })
}

fn miri(req: &mut Request) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: MiriRequest| {
        sandbox
            .miri(&req.into())
            .map(MiriResponse::from)
            .map_err(Error::Sandbox)
    })
}

fn meta_crates(_req: &mut Request) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        cached(sandbox)
            .crates()
            .map(MetaCratesResponse::from)
    })
}

fn meta_version_stable(_req: &mut Request) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        cached(sandbox)
            .version_stable()
            .map(MetaVersionResponse::from)
    })
}

fn meta_version_beta(_req: &mut Request) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        cached(sandbox)
            .version_beta()
            .map(MetaVersionResponse::from)
    })
}

fn meta_version_nightly(_req: &mut Request) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        cached(sandbox)
            .version_nightly()
            .map(MetaVersionResponse::from)
    })
}

fn meta_version_rustfmt(_req: &mut Request) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        cached(sandbox)
            .version_rustfmt()
            .map(MetaVersionResponse::from)
    })
}

fn meta_version_clippy(_req: &mut Request) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        cached(sandbox)
            .version_clippy()
            .map(MetaVersionResponse::from)
    })
}

fn meta_version_miri(_req: &mut Request) -> IronResult<Response> {
    with_sandbox_no_request(|sandbox| {
        cached(sandbox)
            .version_miri()
            .map(MetaVersionResponse::from)
    })
}

fn meta_gist_create(req: &mut Request) -> IronResult<Response> {
    let token = req.extensions.get::<GhToken>().unwrap().0.as_ref().clone();
    serialize_to_response(deserialize_from_request(req, |r: MetaGistCreateRequest| {
        let gist = gist::create(token, r.code);
        Ok(MetaGistResponse::from(gist))
    }))
}

fn meta_gist_get(req: &mut Request) -> IronResult<Response> {
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
fn evaluate(req: &mut Request) -> IronResult<Response> {
    with_sandbox(req, |sandbox, req: EvaluateRequest| {
        let req = req.try_into()?;
        sandbox
            .execute(&req)
            .map(EvaluateResponse::from)
            .map_err(Error::Sandbox)
    })
}

fn with_sandbox<Req, Resp, F>(req: &mut Request, f: F) -> IronResult<Response>
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

fn run_handler<Req, Resp, F>(req: &mut Request, f: F) -> Result<Resp>
where
    F: FnOnce(Sandbox, Req) -> Result<Resp>,
    Req: DeserializeOwned + Clone + Any + 'static,
{
    deserialize_from_request(req, |req| {
        let sandbox = Sandbox::new()?;
        f(sandbox, req)
    })
}

fn deserialize_from_request<Req, Resp, F>(req: &mut Request, f: F) -> Result<Resp>
where
    F: FnOnce(Req) -> Result<Resp>,
    Req: DeserializeOwned + Clone + Any + 'static,
{
    let body = req.get::<bodyparser::Struct<Req>>()
        .map_err(Error::Deserialization)?;

    let req = body.ok_or(Error::RequestMissing)?;

    let resp = f(req)?;

    Ok(resp)
}

fn run_handler_no_request<Resp, F>(f: F) -> Result<Resp>
where
    F: FnOnce(Sandbox) -> Result<Resp>,
{
    let sandbox = Sandbox::new()?;
    let resp = f(sandbox)?;
    Ok(resp)
}

fn serialize_to_response<Resp>(response: Result<Resp>) -> IronResult<Response>
where
    Resp: Serialize,
{
    let response = response.and_then(|resp| {
        let resp = serde_json::ser::to_string(&resp)?;
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
        let value = populator().map_err(Error::Sandbox)?;
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

quick_error! {
    #[derive(Debug)]
    pub enum Error {
        Sandbox(err: sandbox::Error) {
            description("sandbox operation failed")
            display("Sandbox operation failed: {}", err)
            cause(err)
            from()
        }
        Serialization(err: serde_json::Error) {
            description("unable to serialize response")
            display("Unable to serialize response: {}", err)
            cause(err)
            from()
        }
        Deserialization(err: bodyparser::BodyError) {
            description("unable to deserialize request")
            display("Unable to deserialize request: {}", err)
            cause(err)
            from()
        }
        InvalidTarget(value: String) {
            description("an invalid target was passed")
            display("The value {:?} is not a valid target", value)
        }
        InvalidAssemblyFlavor(value: String) {
            description("an invalid assembly flavor was passed")
            display("The value {:?} is not a valid assembly flavor", value)
        }
        InvalidDemangleAssembly(value: String) {
            description("an invalid demangling option was passed")
            display("The value {:?} is not a valid demangle option", value)
        }
        InvalidProcessAssembly(value: String) {
            description("an invalid assembly processing option was passed")
            display("The value {:?} is not a valid assembly processing option", value)
        }
        InvalidChannel(value: String) {
            description("an invalid channel was passed")
            display("The value {:?} is not a valid channel", value,)
        }
        InvalidMode(value: String) {
            description("an invalid mode was passed")
            display("The value {:?} is not a valid mode", value)
        }
        InvalidEdition(value: String) {
            description("an invalid edition was passed")
            display("The value {:?} is not a valid edition", value)
        }
        InvalidCrateType(value: String) {
            description("an invalid crate type was passed")
            display("The value {:?} is not a valid crate type", value)
        }
        RequestMissing {
            description("no request was provided")
            display("No request was provided")
        }
        CachePoisoned {
            description("the cache has been poisoned")
            display("The cache has been poisoned")
        }
    }
}

type Result<T> = ::std::result::Result<T, Error>;

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
}

#[derive(Debug, Clone, Serialize)]
struct MiriResponse {
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
}

#[derive(Debug, Clone, Serialize)]
struct EvaluateResponse {
    result: String,
    error: Option<String>,
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
            channel: try!(parse_channel(&me.channel)),
            mode: try!(parse_mode(&me.mode)),
            edition: parse_edition(&me.edition)?,
            crate_type: try!(parse_crate_type(&me.crate_type)),
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

impl From<ClippyRequest> for sandbox::ClippyRequest {
    fn from(me: ClippyRequest) -> Self {
        sandbox::ClippyRequest {
            code: me.code,
        }
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

impl From<MiriRequest> for sandbox::MiriRequest {
    fn from(me: MiriRequest) -> Self {
        sandbox::MiriRequest {
            code: me.code,
        }
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
            edition: None, // FIXME: What should this be?
            crate_type: sandbox::CrateType::Binary,
            tests: false,
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

fn parse_target(s: &str) -> Result<sandbox::CompileTarget> {
    Ok(match s {
        "asm" => sandbox::CompileTarget::Assembly(sandbox::AssemblyFlavor::Att,
                                                  sandbox::DemangleAssembly::Demangle,
                                                  sandbox::ProcessAssembly::Filter),
        "llvm-ir" => sandbox::CompileTarget::LlvmIr,
        "mir" => sandbox::CompileTarget::Mir,
        "wasm" => sandbox::CompileTarget::Wasm,
        _ => return Err(Error::InvalidTarget(s.into()))
    })
}

fn parse_assembly_flavor(s: &str) -> Result<sandbox::AssemblyFlavor> {
    Ok(match s {
        "att" => sandbox::AssemblyFlavor::Att,
        "intel" => sandbox::AssemblyFlavor::Intel,
        _ => return Err(Error::InvalidAssemblyFlavor(s.into()))
    })
}

fn parse_demangle_assembly(s: &str) -> Result<sandbox::DemangleAssembly> {
    Ok(match s {
        "demangle" => sandbox::DemangleAssembly::Demangle,
        "mangle" => sandbox::DemangleAssembly::Mangle,
        _ => return Err(Error::InvalidDemangleAssembly(s.into()))
    })
}

fn parse_process_assembly(s: &str) -> Result<sandbox::ProcessAssembly> {
    Ok(match s {
        "filter" => sandbox::ProcessAssembly::Filter,
        "raw" => sandbox::ProcessAssembly::Raw,
        _ => return Err(Error::InvalidProcessAssembly(s.into()))
    })
}

fn parse_channel(s: &str) -> Result<sandbox::Channel> {
    Ok(match s {
        "stable" => sandbox::Channel::Stable,
        "beta" => sandbox::Channel::Beta,
        "nightly" => sandbox::Channel::Nightly,
        _ => return Err(Error::InvalidChannel(s.into()))
    })
}

fn parse_mode(s: &str) -> Result<sandbox::Mode> {
    Ok(match s {
        "debug" => sandbox::Mode::Debug,
        "release" => sandbox::Mode::Release,
        _ => return Err(Error::InvalidMode(s.into()))
    })
}

fn parse_edition(s: &str) -> Result<Option<sandbox::Edition>> {
    Ok(match s {
        "" => None,
        "2015" => Some(sandbox::Edition::Rust2015),
        "2018" => Some(sandbox::Edition::Rust2018),
        _ => return Err(Error::InvalidEdition(s.into()))
    })
}

fn parse_crate_type(s: &str) -> Result<sandbox::CrateType> {
    use sandbox::{CrateType::*, LibraryType::*};
    Ok(match s {
        "bin" => Binary,
        "lib" => Library(Lib),
        "dylib" => Library(Dylib),
        "rlib" => Library(Rlib),
        "staticlib" => Library(Staticlib),
        "cdylib" => Library(Cdylib),
        "proc-macro" => Library(ProcMacro),
        _ => return Err(Error::InvalidCrateType(s.into()))
    })
}
