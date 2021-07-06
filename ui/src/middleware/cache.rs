use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    http::{
        header::{self, CacheControl, CacheDirective, IntoHeaderValue},
        StatusCode,
    },
    Error,
};
use futures_util::future::{ok, Ready};
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Duration;
use std::{cmp, u32};

/// Sets the Cache-Control header for successful responses.
#[derive(Default, Debug, Clone)]
pub struct Cache {
    max_age: u32,
    assets_prefix: Option<Vec<String>>,
    assets_max_age: Option<u32>,
}

impl Cache {
    pub fn new(duration: Duration) -> Cache {
        // Capping the value at ~136 years!
        let max_age = cmp::min(duration.as_secs(), u32::MAX as u64) as u32;

        Cache {
            max_age,
            ..Self::default()
        }
    }

    pub fn assets_cache(mut self, prefix: &[&str], duration: Duration) -> Self {
        let assets_max_age = cmp::min(duration.as_secs(), u32::MAX as u64) as u32;
        self.assets_prefix = Some(prefix.iter().map(|x| x.to_string()).collect());
        self.assets_max_age = Some(assets_max_age);
        self
    }

    fn max_age(&self, path: &str) -> u32 {
        if let Some((assets_prefix, assets_max_age)) =
            self.assets_prefix.as_ref().zip(self.assets_max_age)
        {
            if path
                .split("/")
                .zip(assets_prefix.iter())
                .all(|(path, prefix)| path == prefix)
            {
                return assets_max_age;
            }
        }
        self.max_age
    }
}

impl<S, B> Transform<S> for Cache
where
    S: Service<Request = ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Request = ServiceRequest;
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = CacheMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(CacheMiddleware {
            service,
            opts: self.clone(),
        })
    }
}

pub struct CacheMiddleware<S> {
    opts: Cache,
    service: S,
}

impl<S, B> Service for CacheMiddleware<S>
where
    S: Service<Request = ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Request = ServiceRequest;
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&mut self, req: ServiceRequest) -> Self::Future {
        let max_age = self.opts.max_age(req.uri().path());
        let fut = self.service.call(req);

        Box::pin(async move {
            let mut res = fut.await?;

            if !matches!(res.status(), StatusCode::OK | StatusCode::NOT_MODIFIED) {
                return Ok(res);
            }

            res.headers_mut().insert(
                header::CACHE_CONTROL,
                CacheControl(vec![
                    CacheDirective::Public,
                    CacheDirective::MaxAge(max_age),
                ])
                .try_into()
                .unwrap(),
            );

            Ok::<_, Error>(res)
        })
    }
}
