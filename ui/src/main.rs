#![deny(rust_2018_idioms)]

use crate::env::{PLAYGROUND_GITHUB_TOKEN, PLAYGROUND_UI_ROOT};
use serde::{Deserialize, Serialize};
use snafu::prelude::*;
use std::{
    convert::TryFrom,
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::Arc,
};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

const DEFAULT_ADDRESS: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5000;

mod env;
mod gist;
mod metrics;
mod sandbox;
mod server_axum;

fn main() {
    // Dotenv may be unable to load environment variables, but that's ok in production
    let _ = dotenv::dotenv();
    openssl_probe::init_ssl_cert_env_vars();

    // Info-level logging is enabled by default.
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = Config::from_env();
    server_axum::serve(config);
}

#[derive(Copy, Clone)]
pub(crate) struct FeatureFlags {}

struct Config {
    address: String,
    cors_enabled: bool,
    gh_token: Option<String>,
    metrics_token: Option<String>,
    feature_flags: FeatureFlags,
    port: u16,
    root: PathBuf,
}

impl Config {
    fn from_env() -> Self {
        let root = if let Some(root) = env::var_os(PLAYGROUND_UI_ROOT) {
            // Ensure it appears as an absolute path in logs to help user orient
            // themselves about what directory the PLAYGROUND_UI_ROOT
            // configuration is interpreted relative to.
            let mut root = PathBuf::from(root);
            if !root.is_absolute() {
                if let Ok(current_dir) = env::current_dir() {
                    root = current_dir.join(root);
                }
            }
            root
        } else {
            // Note this is `env!` (compile time) while the above is
            // `env::var_os` (run time). We know where the ui is expected to be
            // relative to the source code that the server was compiled from.
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("frontend")
                .join("build")
        };

        let index_html = root.join("index.html");
        if index_html.exists() {
            info!("Serving playground frontend from {}", root.display());
        } else {
            error!(
                "Playground ui does not exist at {}\n\
                Playground will not work until `pnpm build` has been run or {PLAYGROUND_UI_ROOT} has been fixed",
                index_html.display(),
            );
        }

        let address =
            env::var("PLAYGROUND_UI_ADDRESS").unwrap_or_else(|_| DEFAULT_ADDRESS.to_string());
        let port = env::var("PLAYGROUND_UI_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(DEFAULT_PORT);

        let gh_token = env::var(PLAYGROUND_GITHUB_TOKEN).ok();
        if gh_token.is_none() {
            warn!("Environment variable {} is not set, so reading and writing GitHub gists will not work", PLAYGROUND_GITHUB_TOKEN);
        }

        let metrics_token = env::var("PLAYGROUND_METRICS_TOKEN").ok();

        let cors_enabled = env::var_os("PLAYGROUND_CORS_ENABLED").is_some();

        let feature_flags = FeatureFlags {};

        Self {
            address,
            cors_enabled,
            gh_token,
            metrics_token,
            feature_flags,
            port,
            root,
        }
    }

    fn root_path(&self) -> &Path {
        &self.root
    }

    fn asset_path(&self) -> PathBuf {
        self.root.join("assets")
    }

    fn use_cors(&self) -> bool {
        self.cors_enabled
    }

    fn metrics_token(&self) -> Option<MetricsToken> {
        self.metrics_token.as_deref().map(MetricsToken::new)
    }

    fn github_token(&self) -> GhToken {
        GhToken::new(&self.gh_token)
    }

    fn server_socket_addr(&self) -> SocketAddr {
        let address = self.address.parse().expect("Invalid address");
        SocketAddr::new(address, self.port)
    }
}

#[derive(Debug, Clone)]
struct GhToken(Option<Arc<String>>);

impl GhToken {
    fn new(token: &Option<String>) -> Self {
        GhToken(token.clone().map(Arc::new))
    }

    fn must_get(&self) -> Result<String> {
        self.0
            .as_ref()
            .map(|s| String::clone(s))
            .context(NoGithubTokenSnafu)
    }
}

#[derive(Debug, Clone)]
struct MetricsToken(Arc<String>);

impl MetricsToken {
    fn new(token: impl Into<String>) -> Self {
        MetricsToken(Arc::new(token.into()))
    }
}

#[derive(Debug, Snafu)]
enum Error {
    #[snafu(display("Sandbox creation failed: {}", source))]
    SandboxCreation { source: sandbox::Error },
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
    #[snafu(display("Gist creation failed: {}", source))]
    GistCreation { source: octocrab::Error },
    #[snafu(display("Gist loading failed: {}", source))]
    GistLoading { source: octocrab::Error },
    #[snafu(display("{PLAYGROUND_GITHUB_TOKEN} not set up for reading/writing gists"))]
    NoGithubToken,
    #[snafu(display("Unable to deserialize request: {}", source))]
    Deserialization { source: serde_json::Error },
    #[snafu(display("Unable to serialize response: {}", source))]
    Serialization { source: serde_json::Error },

    #[snafu(context(false))]
    EvaluateRequest {
        source: server_axum::api_orchestrator_integration_impls::ParseEvaluateRequestError,
    },

    #[snafu(context(false))]
    CompileRequest {
        source: server_axum::api_orchestrator_integration_impls::ParseCompileRequestError,
    },

    #[snafu(context(false))]
    ExecuteRequest {
        source: server_axum::api_orchestrator_integration_impls::ParseExecuteRequestError,
    },

    // Remove at a later point. From here ...
    #[snafu(display("The value {:?} is not a valid edition", value))]
    InvalidEdition { value: String },
    #[snafu(display("The value {:?} is not a valid crate type", value))]
    InvalidCrateType { value: String },
    // ... to here
    #[snafu(display("No request was provided"))]
    RequestMissing,
    #[snafu(display("The cache has been poisoned"))]
    CachePoisoned,
    #[snafu(display("The WebSocket worker panicked: {}", text))]
    WebSocketTaskPanic { text: String },

    #[snafu(display("Unable to shutdown the coordinator"))]
    ShutdownCoordinator {
        source: orchestrator::coordinator::Error,
    },

    #[snafu(display("Unable to convert the evaluate request"))]
    Evaluate {
        source: orchestrator::coordinator::ExecuteError,
    },

    #[snafu(display("Unable to convert the compile request"))]
    Compile {
        source: orchestrator::coordinator::CompileError,
    },

    #[snafu(display("Unable to convert the execute request"))]
    Execute {
        source: orchestrator::coordinator::ExecuteError,
    },

    #[snafu(display("The operation timed out"))]
    Timeout { source: tokio::time::error::Elapsed },

    #[snafu(display("Unable to spawn a coordinator task"))]
    StreamingCoordinatorSpawn {
        source: server_axum::WebsocketCoordinatorManagerError,
    },

    #[snafu(display("Unable to idle the coordinator"))]
    StreamingCoordinatorIdle {
        source: server_axum::WebsocketCoordinatorManagerError,
    },

    #[snafu(display("Unable to perform a streaming execute"))]
    StreamingExecute {
        source: server_axum::WebsocketExecuteError,
    },
}

type Result<T, E = Error> = ::std::result::Result<T, E>;

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
    #[serde(rename = "exitDetail")]
    exit_detail: String,
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
    #[serde(rename = "exitDetail")]
    exit_detail: String,
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

#[derive(Debug, Clone, PartialEq, Serialize)]
struct CrateInformation {
    name: String,
    version: String,
    id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct MetaCratesResponse {
    crates: Arc<[CrateInformation]>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct MetaVersionResponse {
    version: Arc<str>,
    hash: Arc<str>,
    date: Arc<str>,
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
        let crates = me
            .into_iter()
            .map(|cv| CrateInformation {
                name: cv.name,
                version: cv.version,
                id: cv.id,
            })
            .collect();

        MetaCratesResponse { crates }
    }
}

impl From<sandbox::Version> for MetaVersionResponse {
    fn from(me: sandbox::Version) -> Self {
        MetaVersionResponse {
            version: me.release.into(),
            hash: me.commit_hash.into(),
            date: me.commit_date.into(),
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

fn parse_edition(s: &str) -> Result<Option<sandbox::Edition>> {
    Ok(match s {
        "" => None,
        "2015" => Some(sandbox::Edition::Rust2015),
        "2018" => Some(sandbox::Edition::Rust2018),
        "2021" => Some(sandbox::Edition::Rust2021),
        value => InvalidEditionSnafu { value }.fail()?,
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
        value => InvalidCrateTypeSnafu { value }.fail()?,
    })
}

fn default_crate_type() -> String {
    "bin".into()
}
