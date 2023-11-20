use crate::{
    gist,
    metrics::{
        record_metric, track_metric_async, track_metric_no_request_async, Endpoint, GenerateLabels,
        HasLabelsCore, Outcome, SuccessDetails, UNAVAILABLE_WS,
    },
    sandbox::{self, Channel, Sandbox, DOCKER_PROCESS_TIMEOUT_SOFT},
    CachingSnafu, ClippyRequest, ClippyResponse, CompileRequest, CompileResponse, CompileSnafu,
    Config, Error, ErrorJson, EvaluateRequest, EvaluateResponse, EvaluateSnafu, ExecuteRequest,
    ExecuteResponse, ExecuteSnafu, ExpansionSnafu, FormatRequest, FormatResponse, FormatSnafu,
    GhToken, GistCreationSnafu, GistLoadingSnafu, InterpretingSnafu, LintingSnafu,
    MacroExpansionRequest, MacroExpansionResponse, MetaCratesResponse, MetaGistCreateRequest,
    MetaGistResponse, MetaVersionResponse, MetricsToken, MiriRequest, MiriResponse, Result,
    SandboxCreationSnafu, ShutdownCoordinatorSnafu, TimeoutSnafu,
};
use async_trait::async_trait;
use axum::{
    extract::{self, ws::WebSocketUpgrade, Extension, Path, TypedHeader},
    handler::Handler,
    headers::{authorization::Bearer, Authorization, CacheControl, ETag, IfNoneMatch},
    http::{
        header, request::Parts, uri::PathAndQuery, HeaderValue, Method, Request, StatusCode, Uri,
    },
    middleware,
    response::IntoResponse,
    routing::{get, get_service, post, MethodRouter},
    Router,
};
use futures::{future::BoxFuture, FutureExt};
use orchestrator::coordinator::{self, DockerBackend};
use snafu::{prelude::*, IntoError};
use std::{
    convert::{TryFrom, TryInto},
    future::Future,
    mem, path,
    str::FromStr,
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::Mutex;
use tower_http::{
    cors::{self, CorsLayer},
    services::ServeDir,
    set_header::SetResponseHeader,
    trace::TraceLayer,
};

const ONE_HOUR: Duration = Duration::from_secs(60 * 60);
const CORS_CACHE_TIME_TO_LIVE: Duration = ONE_HOUR;

const TEN_MINUTES: Duration = Duration::from_secs(10 * 60);
const SANDBOX_CACHE_TIME_TO_LIVE: Duration = TEN_MINUTES;

const MAX_AGE_ONE_DAY: HeaderValue = HeaderValue::from_static("public, max-age=86400");
const MAX_AGE_ONE_YEAR: HeaderValue = HeaderValue::from_static("public, max-age=31536000");

mod websocket;
pub use websocket::CoordinatorManagerError as WebsocketCoordinatorManagerError;
pub(crate) use websocket::ExecuteError as WebsocketExecuteError;

#[tokio::main]
pub(crate) async fn serve(config: Config) {
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
        .route("/whynowebsocket", get(whynowebsocket))
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

    // Basic access logging
    app = app.layer(TraceLayer::new_for_http());

    axum::Server::bind(&config.server_socket_addr())
        .serve(app.into_make_service())
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

async fn rewrite_help_as_index<B>(
    mut req: Request<B>,
    next: middleware::Next<B>,
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

// This is a backwards compatibilty shim. The Rust documentation uses
// this to run code in place.
async fn evaluate(Json(req): Json<EvaluateRequest>) -> Result<Json<EvaluateResponse>> {
    with_coordinator(req, |c, req| c.execute(req).context(EvaluateSnafu).boxed())
        .await
        .map(Json)
}

async fn compile(Json(req): Json<CompileRequest>) -> Result<Json<CompileResponse>> {
    with_coordinator(req, |c, req| c.compile(req).context(CompileSnafu).boxed())
        .await
        .map(Json)
}

async fn execute(Json(req): Json<ExecuteRequest>) -> Result<Json<ExecuteResponse>> {
    with_coordinator(req, |c, req| c.execute(req).context(ExecuteSnafu).boxed())
        .await
        .map(Json)
}

async fn format(Json(req): Json<FormatRequest>) -> Result<Json<FormatResponse>> {
    with_coordinator(req, |c, req| c.format(req).context(FormatSnafu).boxed())
        .await
        .map(Json)
}

async fn clippy(Json(req): Json<ClippyRequest>) -> Result<Json<ClippyResponse>> {
    with_sandbox(
        req,
        |sb, req| async move { sb.clippy(req).await }.boxed(),
        LintingSnafu,
    )
    .await
    .map(Json)
}

async fn miri(Json(req): Json<MiriRequest>) -> Result<Json<MiriResponse>> {
    with_sandbox(
        req,
        |sb, req| async move { sb.miri(req).await }.boxed(),
        InterpretingSnafu,
    )
    .await
    .map(Json)
}

async fn macro_expansion(
    Json(req): Json<MacroExpansionRequest>,
) -> Result<Json<MacroExpansionResponse>> {
    with_sandbox(
        req,
        |sb, req| async move { sb.macro_expansion(req).await }.boxed(),
        ExpansionSnafu,
    )
    .await
    .map(Json)
}

async fn with_sandbox<F, Req, Resp, SbReq, SbResp, Ctx>(req: Req, f: F, ctx: Ctx) -> Result<Resp>
where
    for<'req> F: FnOnce(Sandbox, &'req SbReq) -> BoxFuture<'req, sandbox::Result<SbResp>>,
    Resp: From<SbResp>,
    SbReq: TryFrom<Req, Error = Error> + GenerateLabels,
    SbResp: SuccessDetails,
    Ctx: IntoError<Error, Source = sandbox::Error>,
{
    let sandbox = Sandbox::new().await.context(SandboxCreationSnafu)?;
    let request = req.try_into()?;
    track_metric_async(request, |request| f(sandbox, request))
        .await
        .map(Into::into)
        .context(ctx)
}

pub(crate) trait HasEndpoint {
    const ENDPOINT: Endpoint;
}

impl HasEndpoint for EvaluateRequest {
    const ENDPOINT: Endpoint = Endpoint::Evaluate;
}

impl HasEndpoint for CompileRequest {
    const ENDPOINT: Endpoint = Endpoint::Compile;
}

impl HasEndpoint for ExecuteRequest {
    const ENDPOINT: Endpoint = Endpoint::Execute;
}

impl HasEndpoint for FormatRequest {
    const ENDPOINT: Endpoint = Endpoint::Format;
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

impl Outcome {
    fn from_success(other: impl IsSuccess) -> Self {
        if other.is_success() {
            Outcome::Success
        } else {
            Outcome::ErrorUserCode
        }
    }
}

async fn with_coordinator<WebReq, WebResp, Req, Resp, F>(req: WebReq, f: F) -> Result<WebResp>
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
    let coordinator = orchestrator::coordinator::Coordinator::new_docker().await;

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
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    // Json<MetaCratesResponse
    let value = track_metric_no_request_async(Endpoint::MetaCrates, || cache.crates()).await?;

    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_stable(
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionStable, || cache.version_stable())
            .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_beta(
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionBeta, || cache.version_beta()).await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_nightly(
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionNightly, || cache.version_nightly())
            .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_rustfmt(
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionRustfmt, || cache.version_rustfmt())
            .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_clippy(
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionClippy, || cache.version_clippy())
            .await?;
    apply_timestamped_caching(value, if_none_match)
}

async fn meta_version_miri(
    Extension(cache): Extension<Arc<SandboxCache>>,
    if_none_match: Option<TypedHeader<IfNoneMatch>>,
) -> Result<impl IntoResponse> {
    let value =
        track_metric_no_request_async(Endpoint::MetaVersionMiri, || cache.version_miri()).await?;
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

async fn meta_gist_create(
    Extension(token): Extension<GhToken>,
    Json(req): Json<MetaGistCreateRequest>,
) -> Result<Json<MetaGistResponse>> {
    let token = token.must_get()?;
    gist::create_future(token, req.code)
        .await
        .map(Into::into)
        .map(Json)
        .context(GistCreationSnafu)
}

async fn meta_gist_get(
    Extension(token): Extension<GhToken>,
    Path(id): Path<String>,
) -> Result<Json<MetaGistResponse>> {
    let token = token.must_get()?;
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
    Extension(feature_flags): Extension<crate::FeatureFlags>,
) -> impl IntoResponse {
    ws.on_upgrade(move |s| websocket::handle(s, feature_flags.into()))
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

lazy_static::lazy_static! {
    static ref WS_ERRORS: std::sync::Mutex<std::collections::HashMap<String, usize>> = Default::default();
}

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
    crates: CacheOne<MetaCratesResponse>,
    version_stable: CacheOne<MetaVersionResponse>,
    version_beta: CacheOne<MetaVersionResponse>,
    version_nightly: CacheOne<MetaVersionResponse>,
    version_rustfmt: CacheOne<MetaVersionResponse>,
    version_clippy: CacheOne<MetaVersionResponse>,
    version_miri: CacheOne<MetaVersionResponse>,
}

impl SandboxCache {
    async fn crates(&self) -> Result<Stamped<MetaCratesResponse>> {
        self.crates
            .fetch(
                |sandbox| async move { Ok(sandbox.crates().await.context(CachingSnafu)?.into()) },
            )
            .await
    }

    async fn version_stable(&self) -> Result<Stamped<MetaVersionResponse>> {
        self.version_stable
            .fetch(|sandbox| async move {
                let version = sandbox
                    .version(Channel::Stable)
                    .await
                    .context(CachingSnafu)?;
                Ok(version.into())
            })
            .await
    }

    async fn version_beta(&self) -> Result<Stamped<MetaVersionResponse>> {
        self.version_beta
            .fetch(|sandbox| async move {
                let version = sandbox.version(Channel::Beta).await.context(CachingSnafu)?;
                Ok(version.into())
            })
            .await
    }

    async fn version_nightly(&self) -> Result<Stamped<MetaVersionResponse>> {
        self.version_nightly
            .fetch(|sandbox| async move {
                let version = sandbox
                    .version(Channel::Nightly)
                    .await
                    .context(CachingSnafu)?;
                Ok(version.into())
            })
            .await
    }

    async fn version_rustfmt(&self) -> Result<Stamped<MetaVersionResponse>> {
        self.version_rustfmt
            .fetch(|sandbox| async move {
                Ok(sandbox
                    .version_rustfmt()
                    .await
                    .context(CachingSnafu)?
                    .into())
            })
            .await
    }

    async fn version_clippy(&self) -> Result<Stamped<MetaVersionResponse>> {
        self.version_clippy
            .fetch(|sandbox| async move {
                Ok(sandbox.version_clippy().await.context(CachingSnafu)?.into())
            })
            .await
    }

    async fn version_miri(&self) -> Result<Stamped<MetaVersionResponse>> {
        self.version_miri
            .fetch(|sandbox| async move {
                Ok(sandbox.version_miri().await.context(CachingSnafu)?.into())
            })
            .await
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
        F: FnOnce(Sandbox) -> FFut,
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
        F: FnOnce(Sandbox) -> FFut,
        FFut: Future<Output = Result<T>>,
    {
        let sandbox = Sandbox::new().await.context(SandboxCreationSnafu)?;
        let value = generator(sandbox).await?;

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
        Json(ErrorJson {
            error: self.to_string(),
        })
        .into_response()
    }
}

/// This type only exists so that we can recover from the `axum::Json`
/// error and format it using our expected JSON error object.
struct Json<T>(T);

#[async_trait]
impl<T, S, B> extract::FromRequest<S, B> for Json<T>
where
    T: serde::de::DeserializeOwned,
    S: Send + Sync,
    B: axum::body::HttpBody + Send + 'static,
    B::Data: Send,
    B::Error: Into<axum::BoxError>,
{
    type Rejection = axum::response::Response;

    async fn from_request(req: Request<B>, state: &S) -> Result<Self, Self::Rejection> {
        match axum::Json::<T>::from_request(req, state).await {
            Ok(v) => Ok(Self(v.0)),
            Err(e) => {
                let error = format!("Unable to deserialize request: {e}");
                Err(axum::Json(ErrorJson { error }).into_response())
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

pub(crate) mod api_orchestrator_integration_impls {
    use orchestrator::coordinator::*;
    use snafu::prelude::*;
    use std::convert::TryFrom;

    impl TryFrom<crate::EvaluateRequest> for ExecuteRequest {
        type Error = ParseEvaluateRequestError;

        fn try_from(other: crate::EvaluateRequest) -> Result<Self, Self::Error> {
            let crate::EvaluateRequest {
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
        #[snafu(context(false))]
        Channel { source: ParseChannelError },

        #[snafu(context(false))]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<ExecuteResponse>> for crate::EvaluateResponse {
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
                crate::EvaluateResponse {
                    result: stdout,
                    error: None,
                }
            } else {
                // When an error occurs, *some* consumers check for an
                // `error` key, others assume that the error is crammed in
                // the `result` field and then they string search for
                // `error:` or `warning:`. Ew. We can put it in both.
                let result = stderr + &stdout;
                crate::EvaluateResponse {
                    result: result.clone(),
                    error: Some(result),
                }
            }
        }
    }

    impl TryFrom<crate::CompileRequest> for CompileRequest {
        type Error = ParseCompileRequestError;

        fn try_from(other: crate::CompileRequest) -> Result<Self, Self::Error> {
            let crate::CompileRequest {
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
        #[snafu(context(false))]
        Target { source: ParseCompileTargetError },

        #[snafu(context(false))]
        Channel { source: ParseChannelError },

        #[snafu(context(false))]
        CrateType { source: ParseCrateTypeError },

        #[snafu(context(false))]
        Mode { source: ParseModeError },

        #[snafu(context(false))]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<CompileResponse>> for crate::CompileResponse {
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

    impl TryFrom<crate::ExecuteRequest> for ExecuteRequest {
        type Error = ParseExecuteRequestError;

        fn try_from(other: crate::ExecuteRequest) -> Result<Self, Self::Error> {
            let crate::ExecuteRequest {
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
        #[snafu(context(false))]
        Channel { source: ParseChannelError },

        #[snafu(context(false))]
        CrateType { source: ParseCrateTypeError },

        #[snafu(context(false))]
        Mode { source: ParseModeError },

        #[snafu(context(false))]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<ExecuteResponse>> for crate::ExecuteResponse {
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

    impl TryFrom<crate::FormatRequest> for FormatRequest {
        type Error = ParseFormatRequestError;

        fn try_from(other: crate::FormatRequest) -> std::result::Result<Self, Self::Error> {
            let crate::FormatRequest { code, edition } = other;

            Ok(FormatRequest {
                channel: Channel::Nightly,     // TODO: use what user has submitted
                crate_type: CrateType::Binary, // TODO: use what user has submitted
                edition: parse_edition(&edition)?,
                code,
            })
        }
    }

    #[derive(Debug, Snafu)]
    pub(crate) enum ParseFormatRequestError {
        #[snafu(context(false))]
        Edition { source: ParseEditionError },
    }

    impl From<WithOutput<FormatResponse>> for crate::FormatResponse {
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
        #[snafu(context(false))]
        AssemblyFlavor { source: ParseAssemblyFlavorError },

        #[snafu(context(false))]
        DemangleAssembly { source: ParseDemangleAssemblyError },

        #[snafu(context(false))]
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
}
