use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    http::Uri,
    Error,
};
use futures_util::future::{ok, Ready};
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

#[derive(Clone)]
pub struct Rewrite {
    from: Vec<Vec<String>>,
    to: String,
}

impl Rewrite {
    pub fn new(from_paths: Vec<Vec<String>>, to_path: String) -> Self {
        Rewrite {
            from: from_paths,
            to: to_path,
        }
    }
}

impl<S, B> Transform<S> for Rewrite
where
    S: Service<Request = ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Request = ServiceRequest;
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RewriteMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(RewriteMiddleware {
            service,
            opts: self.clone(),
        })
    }
}

pub struct RewriteMiddleware<S> {
    opts: Rewrite,
    service: S,
}

impl<S, B> Service for RewriteMiddleware<S>
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
        let fut = self.service.call(req);

        Box::pin(async move {
            let should_rewrite = {
                let request_path = req.uri().path();
                self.opts
                    .from
                    .iter()
                    .any(|rewrite_path| request_path == *rewrite_path)
            };

            if should_rewrite {
                let mut u = req.uri().clone().into();
                u.set_path(&self.opts.to);
                req.url = Uri::from_generic_url(u).expect("Invalid rewritten URL");
            }

            fut.await
        })
    }
}
