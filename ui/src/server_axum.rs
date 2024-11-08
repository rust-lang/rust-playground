use crate::{
    gist,
    metrics::{
        record_metric, track_metric_no_request_async, Endpoint, HasLabelsCore, Outcome,
        UNAVAILABLE_WS,
    },
    request_database::Handle,
    Config, GhToken, MetricsToken,
};
use async_trait::async_trait;
use axum::{
    body::Body,
    extract::{self, ws::WebSocketUpgrade, Extension, Path},
    handler::Handler,
    http::{
        header, request::Parts, uri::PathAndQuery, HeaderName, HeaderValue, Method, Request,
        StatusCode, Uri,
    },
    middleware,
    response::IntoResponse,
    routing::{get, get_service, post, MethodRouter},
    Router,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization, CacheControl, ETag, IfNoneMatch},
    TypedHeader,
};
use futures::{future::BoxFuture, FutureExt};
use orchestrator::coordinator::{self, CoordinatorFactory, DockerBackend, Versions};
use snafu::prelude::*;
use std::{
    convert::TryInto,
    future::Future,
    mem, path,
    str::FromStr,
    sync::{Arc, LazyLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::Mutex;
use tower_http::{
    cors::{self, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    services::ServeDir,
    set_header::SetResponseHeader,
    trace::TraceLayer,
};
use tracing::{error, error_span, field};

use crate::{env::PLAYGROUND_GITHUB_TOKEN, public_http_api as api};

const ONE_HOUR: Duration = Duration::from_secs(60 * 60);
const CORS_CACHE_TIME_TO_LIVE: Duration = ONE_HOUR;

const TEN_MINUTES: Duration = Duration::from_secs(10 * 60);
const SANDBOX_CACHE_TIME_TO_LIVE: Duration = TEN_MINUTES;

const MAX_AGE_ONE_DAY: HeaderValue = HeaderValue::from_static("public, max-age=86400");
const MAX_AGE_ONE_YEAR: HeaderValue = HeaderValue::from_static("public, max-age=31536000");

const DOCKER_PROCESS_TIMEOUT_SOFT: Duration = Duration::from_secs(10);

mod websocket;

#[derive(Debug, Clone)]
struct Factory(Arc<CoordinatorFactory>);

#[tokio::main]
pub(crate) async fn serve(config: Config) {
    let factory = Factory(Arc::new(config.coordinator_factory()));

    let request_db = config.request_database();
    let (_db_task, db_handle) = request_db.spawn();

    let root_files = static_file_service(config.root_path(), MAX_AGE_ONE_DAY);
    let asset_files = static_file_service(config.asset_path(), MAX_AGE_ONE_YEAR);
    let rewrite_help_as_index = middleware::from_fn(rewrite_help_as_index);

    let mut app = Router::new()
        .fallback_service(root_files)
        .nest_service("/assets", asset_files)
        .layer(rewrite_help_as_index)
        .route("/evaluate.json", post(evaluate))
        .route("/compile", post(compile))
        .route("/execute", post(execute))
        .route("/format", post(format))
        .route("/clippy", post(clippy))
        .route("/miri", post(miri))
        .route("/macro-expansion", post(macro_expansion))
        .route("/meta/crates", get_or_post(meta_crates))
        .route("/meta/versions", get(meta_versions))
        .route("/meta/version/stable", get_or_post(meta_version_stable))
        .route("/meta/version/beta", get_or_post(meta_version_beta))
        .route("/meta/version/nightly", get_or_post(meta_version_nightly))
        .route("/meta/version/rustfmt", get_or_post(meta_version_rustfmt))
        .route("/meta/version/clippy", get_or_post(meta_version_clippy))
        .route("/meta/version/miri", get_or_post(meta_version_miri))
        .route("/meta/gist", post(meta_gist_create))
        .route("/meta/gist/", post(meta_gist_create)) // compatibility with lax frontend code
        .route("/meta/gist/:id", get(meta_gist_get))
        .route("/metrics", get(metrics))
        .route("/websocket", get(websocket))
        .route("/nowebsocket", post(nowebsocket))
        .route("/internal/debug/whynowebsocket", get(whynowebsocket))
        .layer(Extension(factory))
        .layer(Extension(db_handle))
        .layer(Extension(Arc::new(SandboxCache::default())))
        .layer(Extension(config.github_token()))
        .layer(Extension(config.feature_flags));

    if let Some(token) = config.metrics_token() {
        app = app.layer(Extension(token))
    }

    if config.use_cors() {
        app = app.layer({
            CorsLayer::new()
                .allow_origin(cors::Any)
                .allow_headers([header::CONTENT_TYPE])
                .allow_methods([Method::GET, Method::POST])
                .allow_credentials(false)
                .max_age(CORS_CACHE_TIME_TO_LIVE)
        });
    }

    let x_request_id = HeaderName::from_static("x-request-id");

    // Basic access logging
    app = app.layer(
        TraceLayer::new_for_http().make_span_with(move |req: &Request<_>| {
            const REQUEST_ID: &str = "request_id";

            let method = req.method();
            let uri = req.uri();
            let request_id = req
                .headers()
                .get(&x_request_id)
                .and_then(|id| id.to_str().ok());

            let span = error_span!("request", %method, %uri, { REQUEST_ID } = field::Empty);

            if let Some(request_id) = request_id {
                span.record(REQUEST_ID, field::display(request_id));
            }

            span
        }),
    );

    let x_request_id = HeaderName::from_static("x-request-id");

    // propagate `x-request-id` headers from request to response
    app = app.layer(PropagateRequestIdLayer::new(x_request_id.clone()));

    app = app.layer(SetRequestIdLayer::new(
        x_request_id.clone(),
        MakeRequestUuid::default(),
    ));

    let server_socket_addr = config.server_socket_addr();
    tracing::info!("Serving playground backend at http://{server_socket_addr}");

    let listener = tokio::net::TcpListener::bind(server_socket_addr)
        .await
        .unwrap();

    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

fn get_or_post<T: 'static>(handler: impl Handler<T, ()> + Copy) -> MethodRouter {
    get(handler).post(handler)
}

fn static_file_service(root: impl AsRef<path::Path>, max_age: HeaderValue) -> MethodRouter {
    let files = ServeDir::new(root).precompressed_gzip();

    let with_caching = SetResponseHeader::if_not_present(files, header::CACHE_CONTROL, max_age);

    get_service(with_caching)
}

async fn rewrite_help_as_index(
    mut req: Request<Body>,
    next: middleware::Next,
) -> impl IntoResponse {
    let uri = req.uri_mut();
    if uri.path() == "/help" {
        let rewritten_uri = mem::take(uri);
        let mut parts = rewritten_uri.into_parts();
        parts.path_and_query = Some(PathAndQuery::from_static("/index.html"));
        *uri = Uri::from_parts(parts).unwrap();
    }
    next.run(req).await
}

async fn attempt_record_request<T, RFut, RT, RE>(
    db: Handle,
    req: T,
    f: impl FnOnce(T) -> RFut,
) -> Result<RT, RE>
where
    T: HasEndpoint + serde::Serialize,
    RFut: Future<Output = Result<RT, RE>>,
{
    let category = format!("http.{}", <&str>::from(T::ENDPOINT));
    let payload = serde_json::to_string(&req).unwrap_or_else(|_| String::from("<invalid JSON>"));
    let guard = db.start_with_guard(category, payload).await;

    let r = f(req).await;

    guard.complete_now(r)
}

// This is a backwards compatibilty shim. The Rust documentation uses
// this to run code in place.
async fn evaluate(
    Extension(factory): Extension<Factory>,
    Extension(db): Extension<Handle>,
    Json(req): Json<api::EvaluateRequest>,
) -> Result<Json<api::EvaluateResponse>> {
    attempt_record_request(db, req, |req| async {
        with_coordinator(&factory.0, req, |c, req| {
            c.execute(req).context(EvaluateSnafu).boxed()
        })
        .await
        .map(Json)
    })
    .await
}

async fn compile(
    Extension(factory): Extension<Factory>,
    Extension(db): Extension<Handle>,
    Json(req): Json<api::CompileRequest>,
) -> Result<Json<api::CompileResponse>> {
    attempt_record_request(db, req, |req| async {
        with_coordinator(&factory.0, req, |c, req| {
            c.compile(req).context(CompileSnafu).boxed()
        })
        .await
        .map(Json)
    })
    .await
}

async fn execute(
    Extension(factory): Extension<Factory>,
    Extension(db): Extension<Handle>,
    Json(req): Json<api::ExecuteRequest>,
) -> Result<Json<api::ExecuteResponse>> {
    attempt_record_request(db, req, |req| async {
        with_coordinator(&factory.0, req, |c, req| {
            c.execute(req).context(ExecuteSnafu).boxed()
        })
        .await
        .map(Json)
    })
    .await
}

async fn format(
    Extension(factory): Extension<Factory>,
    Extension(db): Extension<Handle>,
    Json(req): Json<api::FormatRequest>,
) -> Result<Json<api::FormatResponse>> {
    attempt_record_request(db, req, |req| async {
        with_coordinator(&factory.0, req, |c, req| {
            c.format(req).context(FormatSnafu).boxed()
        })
        .await
        .map(Json)
    })
    .await
}

async fn clippy(
    Extension(factory): Extension<Factory>,
    Extension(db): Extension<Handle>,
    Json(req): Json<api::ClippyRequest>,
) -> Result<Json<api::ClippyResponse>> {
    attempt_record_request(db, req, |req| async {
        with_coordinator(&factory.0, req, |c, req| {
            c.clippy(req).context(ClippySnafu).boxed()
        })
        .await
        .map(Json)
    })
    .await
}

async fn miri(
    Extension(factory): Extension<Factory>,
    Extension(db): Extension<Handle>,
    Json(req): Json<api::MiriRequest>,
) -> Result<Json<api::MiriResponse>> {
    attempt_record_request(db, req, |req| async {
        with_coordinator(&factory.0, req, |c, req| {
            c.miri(req).context(MiriSnafu).boxed()
        })
        .await
        .map(Json)
    })
    .await
}

async fn macro_expansion(
    Extension(factory): Extension<Factory>,
    Extension(db): Extension<Handle>,
    Json(req): Json<api::MacroExpansionRequest>,
) -> Result<Json<api::MacroExpansionResponse>> {
    attempt_record_request(db, req, |req| async {
        with_coordinator(&factory.0, req, |c, req| {
            c.macro_expansion(req).context(MacroExpansionSnafu).boxed()
        })
        .await
        .map(Json)
    })
    .await
}

pub(crate) trait HasEndpoint {
    const ENDPOINT: Endpoint;
}

impl HasEndpoint for api::EvaluateRequest {
    const ENDPOINT: Endpoint = Endpoint::Evaluate;
}

impl HasEndpoint for api::CompileRequest {
    const ENDPOINT: Endpoint = Endpoint::Compile;
}

impl HasEndpoint for api::ExecuteRequest {
    const ENDPOINT: Endpoint = Endpoint::Execute;
}

impl HasEndpoint for api::FormatRequest {
    const ENDPOINT: Endpoint = Endpoint::Format;
}

impl HasEndpoint for api::ClippyRequest {
    const ENDPOINT: Endpoint = Endpoint::Clippy;
}

impl HasEndpoint for api::MiriRequest {
    const ENDPOINT: Endpoint = Endpoint::Miri;
}

impl HasEndpoint for api::MacroExpansionRequest {
    const ENDPOINT: Endpoint = Endpoint::MacroExpansion;
}

trait IsSuccess {
    fn is_success(&self) -> bool;
}

impl<T> IsSuccess for &T
where
    T: IsSuccess,
{
    fn is_success(&self) -> bool {
        T::is_success(self)
    }
}

impl<T> IsSuccess for coordinator::WithOutput<T>
where
    T: IsSuccess,
{
    fn is_success(&self) -> bool {
        self.response.is_success()
    }
}

impl IsSuccess for coordinator::CompileResponse {
    fn is_success(&self) -> bool {
        self.success
    }
}

impl IsSuccess for coordinator::ExecuteResponse {
    fn is_success(&self) -> bool {
        self.success
    }
}

impl IsSuccess for coordinator::FormatResponse {
    fn is_success(&self) -> bool {
        self.success
    }
}

impl IsSuccess for coordinator::ClippyResponse {
    fn is_success(&self) -> bool {
        self.success
    }
}

impl IsSuccess for coordinator::MiriResponse {
    fn is_success(&self) -> bool {
        self.success
    }
}

impl IsSuccess for coordinator::MacroExpansionResponse {
    fn is_success(&self) -> bool {
        self.success
    }
}

impl Outcome {
    fn from_success(other: impl IsSuccess) -> Self {
        if other.is_success() {
            Outcome::Success
        } else {
            Outcome::ErrorUserCode
        }
    }
}

async fn with_coordinator<WebReq, WebResp, Req, Resp, F>(
    factory: &CoordinatorFactory,
    req: WebReq,
    f: F,
) -> Result<WebResp>
where
    WebReq: TryInto<Req>,
    WebReq: HasEndpoint,
    Error: From<WebReq::Error>,
    Req: HasLabelsCore,
    Resp: Into<WebResp>,
    Resp: IsSuccess,
    for<'f> F:
        FnOnce(&'f coordinator::Coordinator<DockerBackend>, Req) -> BoxFuture<'f, Result<Resp>>,
{
    let coordinator = factory.build();

    let job = async {
        let req = req.try_into()?;

        let labels_core = req.labels_core();

        let start = Instant::now();

        let job = f(&coordinator, req);
        let resp = tokio::time::timeout(DOCKER_PROCESS_TIMEOUT_SOFT, job).await;

        let elapsed = start.elapsed();

        let outcome = match &resp {
            Ok(Ok(v)) => Outcome::from_success(v),
            Ok(Err(_)) => Outcome::ErrorServer,
            Err(_) => Outcome::ErrorTimeoutSoft,
        };

        // Note that any early return before this point won't be
        // reported in the metrics!

        record_metric(WebReq::ENDPOINT, labels_core, outcome, elapsed);

        let resp = resp.context(TimeoutSnafu)?;

        resp.map(Into::into)
    };

    let resp = job.await;

    coordinator
        .shutdown()
        .await
        .context(ShutdownCoordinatorSnafu)?;

    resp
}

async fn meta_crates(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaCrates, || cache.crates(&factory.0)).await?;

    apply_timestamped_caching(value, if_none_match)
}

async fn meta_versions(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersions, || cache.versions(&factory.0))
            .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_stable(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value = track_metric_no_request_async(Endpoint::MetaVersionStable, || {
        cache.version_stable(&factory.0)
    })
    .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_beta(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionBeta, || cache.version_beta(&factory.0))
            .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_nightly(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value = track_metric_no_request_async(Endpoint::MetaVersionNightly, || {
        cache.version_nightly(&factory.0)
    })
    .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_rustfmt(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value = track_metric_no_request_async(Endpoint::MetaVersionRustfmt, || {
        cache.version_rustfmt(&factory.0)
    })
    .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_clippy(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value = track_metric_no_request_async(Endpoint::MetaVersionClippy, || {
        cache.version_clippy(&factory.0)
    })
    .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_miri(
    Extension(factory): Extension<Factory>,
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionMiri, || cache.version_miri(&factory.0))
            .await?;
    apply_timestamped_caching(value, if_none_match)
}

fn apply_timestamped_caching<T>(
    value: Stamped<T>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse>
where
    Json<T>: IntoResponse,
{
    let (value, timestamp) = value;

    let timestamp = timestamp.duration_since(UNIX_EPOCH).unwrap();
    let etag = format!(r#""pg-ts-{}""#, timestamp.as_secs());
    let etag = ETag::from_str(&etag).unwrap();

    let cache_control = CacheControl::new()
        .with_max_age(SANDBOX_CACHE_TIME_TO_LIVE)
        .with_public();

    let use_fresh = if_none_match.map_or(true, |if_none_match| {
        if_none_match.0.precondition_passes(&etag)
    });

    let etag = TypedHeader(etag);
    let cache_control = TypedHeader(cache_control);

    let response = if use_fresh {
        (StatusCode::OK, Json(value)).into_response()
    } else {
        StatusCode::NOT_MODIFIED.into_response()
    };

    Ok((etag, cache_control, response))
}

fn must_get(token: &GhToken) -> Result<String> {
    token
        .0
        .as_ref()
        .map(|s| String::clone(s))
        .context(NoGithubTokenSnafu)
}

async fn meta_gist_create(
    Extension(token): Extension<GhToken>,
    Json(req): Json<api::MetaGistCreateRequest>,
) -> Result<Json<api::MetaGistResponse>> {
    let token = must_get(&token)?;
    gist::create_future(token, req.code)
        .await
        .map(Into::into)
        .map(Json)
        .context(GistCreationSnafu)
}

async fn meta_gist_get(
    Extension(token): Extension<GhToken>,
    Path(id): Path<String>,
) -> Result<Json<api::MetaGistResponse>> {
    let token = must_get(&token)?;
    gist::load_future(token, &id)
        .await
        .map(Into::into)
        .map(Json)
        .context(GistLoadingSnafu)
}

async fn metrics(_: MetricsAuthorization) -> Result<Vec<u8>, StatusCode> {
    use prometheus::{Encoder, TextEncoder};

    let metric_families = prometheus::gather();
    let encoder = TextEncoder::new();
    let mut buffer = Vec::new();

    encoder
        .encode(&metric_families, &mut buffer)
        .map(|_| buffer)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn websocket(
    ws: WebSocketUpgrade,
    Extension(factory): Extension<Factory>,
    Extension(feature_flags): Extension<crate::FeatureFlags>,
    Extension(db): Extension<Handle>,
) -> impl IntoResponse {
    ws.on_upgrade(move |s| websocket::handle(s, factory.0, feature_flags.into(), db))
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NoWebSocketRequest {
    #[serde(default)]
    error: String,
}

async fn nowebsocket(Json(req): Json<NoWebSocketRequest>) {
    record_websocket_error(req.error);
    UNAVAILABLE_WS.inc();
}

static WS_ERRORS: LazyLock<std::sync::Mutex<std::collections::HashMap<String, usize>>> =
    LazyLock::new(|| Default::default());

fn record_websocket_error(error: String) {
    *WS_ERRORS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .entry(error)
        .or_default() += 1;
}

async fn whynowebsocket() -> String {
    format!("{:#?}", WS_ERRORS.lock().unwrap_or_else(|e| e.into_inner()))
}

#[derive(Debug)]
struct MetricsAuthorization;

type MetricsAuthorizationRejection = (StatusCode, &'static str);

impl MetricsAuthorization {
    const FAILURE: MetricsAuthorizationRejection = (StatusCode::UNAUTHORIZED, "Wrong credentials");
}

#[async_trait]
impl<S> extract::FromRequestParts<S> for MetricsAuthorization
where
    S: Send + Sync,
{
    type Rejection = MetricsAuthorizationRejection;

    async fn from_request_parts(req: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match Extension::<MetricsToken>::from_request_parts(req, state).await {
            Ok(Extension(expected)) => {
                match TypedHeader::<Authorization<Bearer>>::from_request_parts(req, state).await {
                    Ok(TypedHeader(Authorization(actual))) => {
                        if actual.token() == *expected.0 {
                            Ok(Self)
                        } else {
                            Err(Self::FAILURE)
                        }
                    }
                    Err(_) => Err(Self::FAILURE),
                }
            }
            // If we haven't set a code at all, allow the request.
            Err(_) => Ok(Self),
        }
    }
}

type Stamped<T> = (T, SystemTime);

#[derive(Debug, Default)]
struct SandboxCache {
    crates: CacheOne<api::MetaCratesResponse>,
    versions: CacheOne<api::MetaVersionsResponse>,
    raw_versions: CacheOne<Arc<Versions>>,
}

impl SandboxCache {
    async fn crates(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaCratesResponse>> {
        let coordinator = factory.build::<DockerBackend>();

        let c = self
            .crates
            .fetch(|| async { Ok(coordinator.crates().await.context(CratesSnafu)?.into()) })
            .await;

        coordinator
            .shutdown()
            .await
            .context(ShutdownCoordinatorSnafu)?;

        c
    }

    async fn versions(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaVersionsResponse>> {
        let coordinator = factory.build::<DockerBackend>();

        let v = self
            .versions
            .fetch(|| async { Ok(coordinator.versions().await.context(VersionsSnafu)?.into()) })
            .await;

        coordinator
            .shutdown()
            .await
            .context(ShutdownCoordinatorSnafu)?;

        v
    }

    async fn raw_versions(&self, factory: &CoordinatorFactory) -> Result<Stamped<Arc<Versions>>> {
        let coordinator = factory.build::<DockerBackend>();

        let rv = self
            .raw_versions
            .fetch(|| async {
                Ok(Arc::new(
                    coordinator.versions().await.context(VersionsSnafu)?,
                ))
            })
            .await;

        coordinator
            .shutdown()
            .await
            .context(ShutdownCoordinatorSnafu)?;

        rv
    }

    async fn version_stable(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaVersionResponse>> {
        let (v, t) = self.raw_versions(factory).await?;
        let v = (&v.stable.rustc).into();
        Ok((v, t))
    }

    async fn version_beta(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaVersionResponse>> {
        let (v, t) = self.raw_versions(factory).await?;
        let v = (&v.beta.rustc).into();
        Ok((v, t))
    }

    async fn version_nightly(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaVersionResponse>> {
        let (v, t) = self.raw_versions(factory).await?;
        let v = (&v.nightly.rustc).into();
        Ok((v, t))
    }

    async fn version_rustfmt(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaVersionResponse>> {
        let (v, t) = self.raw_versions(factory).await?;
        let v = (&v.nightly.rustfmt).into();
        Ok((v, t))
    }

    async fn version_clippy(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaVersionResponse>> {
        let (v, t) = self.raw_versions(factory).await?;
        let v = (&v.nightly.clippy).into();
        Ok((v, t))
    }

    async fn version_miri(
        &self,
        factory: &CoordinatorFactory,
    ) -> Result<Stamped<api::MetaVersionResponse>> {
        let (v, t) = self.raw_versions(factory).await?;
        let v = v.nightly.miri.as_ref().context(MiriVersionSnafu)?;
        let v = v.into();
        Ok((v, t))
    }
}

#[derive(Debug)]
struct CacheOne<T>(Mutex<Option<CacheInfo<T>>>);

impl<T> Default for CacheOne<T> {
    fn default() -> Self {
        Self(Default::default())
    }
}

impl<T> CacheOne<T>
where
    T: Clone + PartialEq,
{
    async fn fetch<F, FFut>(&self, generator: F) -> Result<Stamped<T>>
    where
        F: FnOnce() -> FFut,
        FFut: Future<Output = Result<T>>,
    {
        let data = &mut *self.0.lock().await;
        match data {
            Some(info) => {
                if info.validation_time.elapsed() <= SANDBOX_CACHE_TIME_TO_LIVE {
                    Ok(info.stamped_value())
                } else {
                    Self::set_value(data, generator).await
                }
            }
            None => Self::set_value(data, generator).await,
        }
    }

    async fn set_value<F, FFut>(data: &mut Option<CacheInfo<T>>, generator: F) -> Result<Stamped<T>>
    where
        F: FnOnce() -> FFut,
        FFut: Future<Output = Result<T>>,
    {
        let value = generator().await?;

        let old_info = data.take();
        let new_info = CacheInfo::build(value);

        let info = match old_info {
            Some(mut old_value) => {
                if old_value.value == new_info.value {
                    // The value hasn't changed; record that we have
                    // checked recently, but keep the creation time to
                    // preserve caching.
                    old_value.validation_time = new_info.validation_time;
                    old_value
                } else {
                    new_info
                }
            }
            None => new_info,
        };

        let value = info.stamped_value();

        *data = Some(info);

        Ok(value)
    }
}

#[derive(Debug)]
struct CacheInfo<T> {
    value: T,
    creation_time: SystemTime,
    validation_time: Instant,
}

impl<T> CacheInfo<T> {
    fn build(value: T) -> Self {
        let creation_time = SystemTime::now();
        let validation_time = Instant::now();

        Self {
            value,
            creation_time,
            validation_time,
        }
    }

    fn stamped_value(&self) -> Stamped<T>
    where
        T: Clone,
    {
        (self.value.clone(), self.creation_time)
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> axum::response::Response {
        let error = snafu::CleanedErrorText::new(&self)
            .map(|(_, s, _)| s)
            .reduce(|l, r| l + ": " + &r)
            .unwrap_or_default();
        error!(error, "Returning an error to the client");
        let resp = Json(api::ErrorJson { error });
        let resp = (StatusCode::INTERNAL_SERVER_ERROR, resp);
        resp.into_response()
    }
}

/// This type only exists so that we can recover from the `axum::Json`
/// error and format it using our expected JSON error object.
struct Json<T>(T);

#[async_trait]
impl<T, S> extract::FromRequest<S> for Json<T>
where
    T: serde::de::DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = axum::response::Response;

    async fn from_request(req: Request<Body>, state: &S) -> Result<Self, Self::Rejection> {
        match axum::Json::<T>::from_request(req, state).await {
            Ok(v) => Ok(Self(v.0)),
            Err(e) => {
                let error = format!("Unable to deserialize request: {e}");
                let resp = axum::Json(api::ErrorJson { error });
                let resp = (StatusCode::BAD_REQUEST, resp);
                Err(resp.into_response())
            }
        }
    }
}

impl<T> IntoResponse for Json<T>
where
    T: serde::Serialize,
{
    fn into_response(self) -> axum::response::Response {
        axum::Json(self.0).into_response()
    }
}

#[derive(Debug, Snafu)]
enum Error {
    #[snafu(display("Gist creation failed"))]
    GistCreation { source: octocrab::Error },

    #[snafu(display("Gist loading failed"))]
    GistLoading { source: octocrab::Error },

    #[snafu(display("{PLAYGROUND_GITHUB_TOKEN} not set up for reading/writing gists"))]
    NoGithubToken,

    #[snafu(transparent)]
    EvaluateRequest {
        source: api_orchestrator_integration_impls::ParseEvaluateRequestError,
    },

    #[snafu(transparent)]
    CompileRequest {
        source: api_orchestrator_integration_impls::ParseCompileRequestError,
    },

    #[snafu(transparent)]
    ExecuteRequest {
        source: api_orchestrator_integration_impls::ParseExecuteRequestError,
    },

    #[snafu(transparent)]
    FormatRequest {
        source: api_orchestrator_integration_impls::ParseFormatRequestError,
    },

    #[snafu(transparent)]
    ClippyRequest {
        source: api_orchestrator_integration_impls::ParseClippyRequestError,
    },

    #[snafu(transparent)]
    MiriRequest {
        source: api_orchestrator_integration_impls::ParseMiriRequestError,
    },

    #[snafu(transparent)]
    MacroExpansionRequest {
        source: api_orchestrator_integration_impls::ParseMacroExpansionRequestError,
    },

    #[snafu(display("Unable to find the available crates"))]
    Crates {
        source: orchestrator::coordinator::CratesError,
    },

    #[snafu(display("Unable to find the available versions"))]
    Versions {
        source: orchestrator::coordinator::VersionsError,
    },

    #[snafu(display("The Miri version was missing"))]
    MiriVersion,

    #[snafu(display("Unable to shutdown the coordinator"))]
    ShutdownCoordinator {
        source: orchestrator::coordinator::Error,
    },

    #[snafu(display("Unable to process the evaluate request"))]
    Evaluate {
        source: orchestrator::coordinator::ExecuteError,
    },

    #[snafu(display("Unable to process the compile request"))]
    Compile {
        source: orchestrator::coordinator::CompileError,
    },

    #[snafu(display("Unable to process the execute request"))]
    Execute {
        source: orchestrator::coordinator::ExecuteError,
    },

    #[snafu(display("Unable to process the format request"))]
    Format {
        source: orchestrator::coordinator::FormatError,
    },

    #[snafu(display("Unable to process the Clippy request"))]
    Clippy {
        source: orchestrator::coordinator::ClippyError,
    },

    #[snafu(display("Unable to process the Miri request"))]
    Miri {
        source: orchestrator::coordinator::MiriError,
    },

    #[snafu(display("Unable to process the macro expansion request"))]
    MacroExpansion {
        source: orchestrator::coordinator::MacroExpansionError,
    },

    #[snafu(display("The operation timed out"))]
    Timeout { source: tokio::time::error::Elapsed },
}

type Result<T, E = Error> = ::std::result::Result<T, E>;

pub(crate) mod api_orchestrator_integration_impls {
    use orchestrator::coordinator::*;
    use snafu::prelude::*;
    use std::convert::TryFrom;

    use crate::gist;
    use crate::public_http_api as api;

    impl From<Vec<Crate>> for api::MetaCratesResponse {
        fn from(other: Vec<Crate>) -> Self {
            let crates = other
                .into_iter()
                .map(|c| {
                    let Crate { name, version, id } = c;
                    api::CrateInformation { name, version, id }
                })
                .collect();
            Self { crates }
        }
    }

    impl From<Versions> for api::MetaVersionsResponse {
        fn from(other: Versions) -> Self {
            let Versions {
                stable,
                beta,
                nightly,
            } = other;
            let [stable, beta, nightly] = [stable, beta, nightly].map(Into::into);
            Self {
                stable,
                beta,
                nightly,
            }
        }
    }

    impl From<ChannelVersions> for api::MetaChannelVersionResponse {
        fn from(other: ChannelVersions) -> Self {
            let ChannelVersions {
                rustc,
                rustfmt,
                clippy,
                miri,
            } = other;
            let [rustc, rustfmt, clippy] = [rustc, rustfmt, clippy].map(|v| (&v).into());
            let miri = miri.map(|v| (&v).into());
            Self {
                rustc,
                rustfmt,
                clippy,
                miri,
            }
        }
    }

    impl From<&Version> for api::MetaVersionResponse {
        fn from(other: &Version) -> Self {
            Self {
                version: (&*other.release).into(),
                hash: (&*other.commit_hash).into(),
                date: (&*other.commit_date).into(),
            }
        }
    }

    impl TryFrom<api::EvaluateRequest> for ExecuteRequest {
        type Error = ParseEvaluateRequestError;

        fn try_from(other: api::EvaluateRequest) -> Result<Self, Self::Error> {
            let api::EvaluateRequest {
                version,
                optimize,
                code,
                edition,
                tests,
            } = other;

            let mode = if optimize != "0" {
                Mode::Release
            } else {
                Mode::Debug
            };

            let edition = if edition.trim().is_empty() {
                Edition::Rust2015
            } else {
                parse_edition(&edition)?
            };

            Ok(ExecuteRequest {
                channel: parse_channel(&version)?,
                mode,
                edition,
                crate_type: CrateType::Binary,
                tests,
                backtrace: false,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseEvaluateRequestError {
        #[snafu(transparent)]
        Channel { source: ParseChannelError },

        #[snafu(transparent)]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<ExecuteResponse>> for api::EvaluateResponse {
        fn from(other: WithOutput<ExecuteResponse>) -> Self {
            let WithOutput {
                response,
                stdout,
                stderr,
            } = other;

            // The old playground didn't use Cargo, so it never had the
            // Cargo output ("Compiling playground...") which is printed
            // to stderr. Since this endpoint is used to inline results on
            // the page, don't include the stderr unless an error
            // occurred.
            if response.success {
                api::EvaluateResponse {
                    result: stdout,
                    error: None,
                }
            } else {
                // When an error occurs, *some* consumers check for an
                // `error` key, others assume that the error is crammed in
                // the `result` field and then they string search for
                // `error:` or `warning:`. Ew. We can put it in both.
                let result = stderr + &stdout;
                api::EvaluateResponse {
                    result: result.clone(),
                    error: Some(result),
                }
            }
        }
    }

    impl TryFrom<api::CompileRequest> for CompileRequest {
        type Error = ParseCompileRequestError;

        fn try_from(other: api::CompileRequest) -> Result<Self, Self::Error> {
            let api::CompileRequest {
                target,
                assembly_flavor,
                demangle_assembly,
                process_assembly,
                channel,
                mode,
                edition,
                crate_type,
                tests,
                backtrace,
                code,
            } = other;

            Ok(Self {
                target: parse_target(
                    &target,
                    assembly_flavor.as_deref(),
                    demangle_assembly.as_deref(),
                    process_assembly.as_deref(),
                )?,
                channel: parse_channel(&channel)?,
                crate_type: parse_crate_type(&crate_type)?,
                mode: parse_mode(&mode)?,
                edition: parse_edition(&edition)?,
                tests,
                backtrace,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseCompileRequestError {
        #[snafu(transparent)]
        Target { source: ParseCompileTargetError },

        #[snafu(transparent)]
        Channel { source: ParseChannelError },

        #[snafu(transparent)]
        CrateType { source: ParseCrateTypeError },

        #[snafu(transparent)]
        Mode { source: ParseModeError },

        #[snafu(transparent)]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<CompileResponse>> for api::CompileResponse {
        fn from(other: WithOutput<CompileResponse>) -> Self {
            let WithOutput {
                response,
                stdout,
                stderr,
            } = other;
            let CompileResponse {
                success,
                exit_detail,
                code,
            } = response;

            Self {
                success,
                exit_detail,
                code,
                stdout,
                stderr,
            }
        }
    }

    impl TryFrom<api::ExecuteRequest> for ExecuteRequest {
        type Error = ParseExecuteRequestError;

        fn try_from(other: api::ExecuteRequest) -> Result<Self, Self::Error> {
            let api::ExecuteRequest {
                channel,
                mode,
                edition,
                crate_type,
                tests,
                backtrace,
                code,
            } = other;

            Ok(Self {
                channel: parse_channel(&channel)?,
                crate_type: parse_crate_type(&crate_type)?,
                mode: parse_mode(&mode)?,
                edition: parse_edition(&edition)?,
                tests,
                backtrace,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseExecuteRequestError {
        #[snafu(transparent)]
        Channel { source: ParseChannelError },

        #[snafu(transparent)]
        CrateType { source: ParseCrateTypeError },

        #[snafu(transparent)]
        Mode { source: ParseModeError },

        #[snafu(transparent)]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<ExecuteResponse>> for api::ExecuteResponse {
        fn from(other: WithOutput<ExecuteResponse>) -> Self {
            let WithOutput {
                response,
                stdout,
                stderr,
            } = other;
            let ExecuteResponse {
                success,
                exit_detail,
            } = response;

            Self {
                success,
                exit_detail,
                stdout,
                stderr,
            }
        }
    }

    impl TryFrom<api::FormatRequest> for FormatRequest {
        type Error = ParseFormatRequestError;

        fn try_from(other: api::FormatRequest) -> std::result::Result<Self, Self::Error> {
            let api::FormatRequest {
                channel,
                edition,
                code,
            } = other;

            let channel = match channel {
                Some(c) => parse_channel(&c)?,
                None => Channel::Nightly,
            };

            Ok(FormatRequest {
                channel,
                crate_type: CrateType::Binary, // TODO: use what user has submitted
                edition: parse_edition(&edition)?,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseFormatRequestError {
        #[snafu(transparent)]
        Channel { source: ParseChannelError },

        #[snafu(transparent)]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<FormatResponse>> for api::FormatResponse {
        fn from(other: WithOutput<FormatResponse>) -> Self {
            let WithOutput {
                response,
                stdout,
                stderr,
            } = other;
            let FormatResponse {
                success,
                exit_detail,
                code,
            } = response;

            Self {
                success,
                exit_detail,
                code,
                stdout,
                stderr,
            }
        }
    }

    impl TryFrom<api::ClippyRequest> for ClippyRequest {
        type Error = ParseClippyRequestError;

        fn try_from(other: api::ClippyRequest) -> std::result::Result<Self, Self::Error> {
            let api::ClippyRequest {
                channel,
                crate_type,
                edition,
                code,
            } = other;

            let channel = match channel {
                Some(c) => parse_channel(&c)?,
                None => Channel::Nightly,
            };

            Ok(ClippyRequest {
                channel,
                crate_type: parse_crate_type(&crate_type)?,
                edition: parse_edition(&edition)?,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseClippyRequestError {
        #[snafu(transparent)]
        Channel { source: ParseChannelError },

        #[snafu(transparent)]
        CrateType { source: ParseCrateTypeError },

        #[snafu(transparent)]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<ClippyResponse>> for api::ClippyResponse {
        fn from(other: WithOutput<ClippyResponse>) -> Self {
            let WithOutput {
                response,
                stdout,
                stderr,
            } = other;
            let ClippyResponse {
                success,
                exit_detail,
            } = response;

            Self {
                success,
                exit_detail,
                stdout,
                stderr,
            }
        }
    }

    impl TryFrom<api::MiriRequest> for MiriRequest {
        type Error = ParseMiriRequestError;

        fn try_from(other: api::MiriRequest) -> std::result::Result<Self, Self::Error> {
            let api::MiriRequest { code, edition } = other;

            Ok(MiriRequest {
                channel: Channel::Nightly,     // TODO: use what user has submitted
                crate_type: CrateType::Binary, // TODO: use what user has submitted
                edition: parse_edition(&edition)?,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseMiriRequestError {
        #[snafu(transparent)]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<MiriResponse>> for api::MiriResponse {
        fn from(other: WithOutput<MiriResponse>) -> Self {
            let WithOutput {
                response,
                stdout,
                stderr,
            } = other;
            let MiriResponse {
                success,
                exit_detail,
            } = response;

            Self {
                success,
                exit_detail,
                stdout,
                stderr,
            }
        }
    }

    impl TryFrom<api::MacroExpansionRequest> for MacroExpansionRequest {
        type Error = ParseMacroExpansionRequestError;

        fn try_from(other: api::MacroExpansionRequest) -> std::result::Result<Self, Self::Error> {
            let api::MacroExpansionRequest { code, edition } = other;

            Ok(MacroExpansionRequest {
                channel: Channel::Nightly,     // TODO: use what user has submitted
                crate_type: CrateType::Binary, // TODO: use what user has submitted
                edition: parse_edition(&edition)?,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseMacroExpansionRequestError {
        #[snafu(transparent)]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<MacroExpansionResponse>> for api::MacroExpansionResponse {
        fn from(other: WithOutput<MacroExpansionResponse>) -> Self {
            let WithOutput {
                response,
                stdout,
                stderr,
            } = other;
            let MacroExpansionResponse {
                success,
                exit_detail,
            } = response;

            Self {
                success,
                exit_detail,
                stdout,
                stderr,
            }
        }
    }

    fn parse_target(
        target: &str,
        assembly_flavor: Option<&str>,
        demangle_assembly: Option<&str>,
        process_assembly: Option<&str>,
    ) -> Result<CompileTarget, ParseCompileTargetError> {
        Ok(match target {
            "asm" => {
                let assembly_flavor = match assembly_flavor {
                    Some(f) => parse_assembly_flavor(f)?,
                    None => AssemblyFlavor::Att,
                };

                let demangle = match demangle_assembly {
                    Some(f) => parse_demangle_assembly(f)?,
                    None => DemangleAssembly::Demangle,
                };

                let process_assembly = match process_assembly {
                    Some(f) => parse_process_assembly(f)?,
                    None => ProcessAssembly::Filter,
                };

                CompileTarget::Assembly(assembly_flavor, demangle, process_assembly)
            }
            "llvm-ir" => CompileTarget::LlvmIr,
            "mir" => CompileTarget::Mir,
            "hir" => CompileTarget::Hir,
            "wasm" => CompileTarget::Wasm,
            value => return InvalidTargetSnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseCompileTargetError {
        #[snafu(transparent)]
        AssemblyFlavor { source: ParseAssemblyFlavorError },

        #[snafu(transparent)]
        DemangleAssembly { source: ParseDemangleAssemblyError },

        #[snafu(transparent)]
        ProcessAssembly { source: ParseProcessAssemblyError },

        #[snafu(display("'{value}' is not a valid target"))]
        InvalidTarget { value: String },
    }

    fn parse_assembly_flavor(s: &str) -> Result<AssemblyFlavor, ParseAssemblyFlavorError> {
        Ok(match s {
            "att" => AssemblyFlavor::Att,
            "intel" => AssemblyFlavor::Intel,
            value => return ParseAssemblyFlavorSnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    #[snafu(display("'{value}' is not a valid assembly flavor"))]
    pub(crate) struct ParseAssemblyFlavorError {
        value: String,
    }

    fn parse_demangle_assembly(s: &str) -> Result<DemangleAssembly, ParseDemangleAssemblyError> {
        Ok(match s {
            "demangle" => DemangleAssembly::Demangle,
            "mangle" => DemangleAssembly::Mangle,
            value => return ParseDemangleAssemblySnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    #[snafu(display("'{value}' is not a valid demangle option"))]
    pub(crate) struct ParseDemangleAssemblyError {
        value: String,
    }

    fn parse_process_assembly(s: &str) -> Result<ProcessAssembly, ParseProcessAssemblyError> {
        Ok(match s {
            "filter" => ProcessAssembly::Filter,
            "raw" => ProcessAssembly::Raw,
            value => return ParseProcessAssemblySnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    #[snafu(display("'{value}' is not a valid assembly processing option"))]
    pub(crate) struct ParseProcessAssemblyError {
        value: String,
    }

    pub(crate) fn parse_channel(s: &str) -> Result<Channel, ParseChannelError> {
        Ok(match s {
            "stable" => Channel::Stable,
            "beta" => Channel::Beta,
            "nightly" => Channel::Nightly,
            value => return ParseChannelSnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    #[snafu(display("'{value}' is not a valid channel"))]
    pub(crate) struct ParseChannelError {
        value: String,
    }

    pub(crate) fn parse_crate_type(s: &str) -> Result<CrateType, ParseCrateTypeError> {
        use {CrateType::*, LibraryType::*};

        Ok(match s {
            "bin" => Binary,
            "lib" => Library(Lib),
            "dylib" => Library(Dylib),
            "rlib" => Library(Rlib),
            "staticlib" => Library(Staticlib),
            "cdylib" => Library(Cdylib),
            "proc-macro" => Library(ProcMacro),
            value => return ParseCrateTypeSnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    #[snafu(display("'{value}' is not a valid crate type"))]
    pub(crate) struct ParseCrateTypeError {
        value: String,
    }

    pub(crate) fn parse_mode(s: &str) -> Result<Mode, ParseModeError> {
        Ok(match s {
            "debug" => Mode::Debug,
            "release" => Mode::Release,
            value => return ParseModeSnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    #[snafu(display("'{value}' is not a valid mode"))]
    pub(crate) struct ParseModeError {
        value: String,
    }

    pub(crate) fn parse_edition(s: &str) -> Result<Edition, ParseEditionError> {
        Ok(match s {
            "2015" => Edition::Rust2015,
            "2018" => Edition::Rust2018,
            "2021" => Edition::Rust2021,
            "2024" => Edition::Rust2024,
            value => return ParseEditionSnafu { value }.fail(),
        })
    }

    #[derive(Debug, Snafu)]
    #[snafu(display("'{value}' is not a valid edition"))]
    pub(crate) struct ParseEditionError {
        value: String,
    }

    impl From<gist::Gist> for api::MetaGistResponse {
        fn from(me: gist::Gist) -> Self {
            api::MetaGistResponse {
                id: me.id,
                url: me.url,
                code: me.code,
            }
        }
    }
}
