#![deny(rust_2018_idioms)]

use orchestrator::coordinator::CoordinatorFactory;
use std::{
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::Arc,
};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

const DEFAULT_ADDRESS: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5000;
const DEFAULT_COORDINATORS_ONE_OFF_LIMIT: usize = 10;
const DEFAULT_COORDINATORS_WEBSOCKET_LIMIT: usize = 50;

mod env;
mod gist;
mod metrics;
mod public_http_api;
mod request_database;
mod server_axum;

use env::{PLAYGROUND_GITHUB_TOKEN, PLAYGROUND_UI_ROOT};

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
    request_db_path: Option<PathBuf>,
    coordinators_one_off_limit: usize,
    coordinators_websocket_limit: usize,
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

        let request_db_path = env::var_os("PLAYGROUND_REQUEST_DATABASE").map(Into::into);

        let coordinators_one_off_limit = env::var("PLAYGROUND_COORDINATORS_ONE_OFF_LIMIT")
            .ok()
            .and_then(|l| l.parse().ok())
            .unwrap_or(DEFAULT_COORDINATORS_ONE_OFF_LIMIT);

        let coordinators_websocket_limit = env::var("PLAYGROUND_COORDINATORS_WEBSOCKET_LIMIT")
            .ok()
            .and_then(|l| l.parse().ok())
            .unwrap_or(DEFAULT_COORDINATORS_WEBSOCKET_LIMIT);

        Self {
            address,
            cors_enabled,
            gh_token,
            metrics_token,
            feature_flags,
            request_db_path,
            coordinators_one_off_limit,
            coordinators_websocket_limit,
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

    fn request_database(&self) -> request_database::Database {
        use request_database::Database;

        let request_db = match &self.request_db_path {
            Some(path) => Database::initialize(path),
            None => Database::initialize_memory(),
        };

        request_db.expect("Unable to open request log database")
    }

    fn coordinator_one_off_factory(&self) -> CoordinatorFactory {
        CoordinatorFactory::new(self.coordinators_one_off_limit)
    }

    fn coordinator_websocket_factory(&self) -> CoordinatorFactory {
        CoordinatorFactory::new(self.coordinators_websocket_limit)
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
}

#[derive(Debug, Clone)]
struct MetricsToken(Arc<String>);

impl MetricsToken {
    fn new(token: impl Into<String>) -> Self {
        MetricsToken(Arc::new(token.into()))
    }
}
