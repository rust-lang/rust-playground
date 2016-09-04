use std::time::{Instant, Duration};

use iron::prelude::*;
use iron::{Handler, AroundMiddleware};

pub struct StatisticLogger;

impl AroundMiddleware for StatisticLogger {
    fn around(self, handler: Box<Handler>) -> Box<Handler> {
        Box::new(LogHandler(handler))
    }
}

struct LogHandler(Box<Handler>);

fn time_it<F, T>(f: F) -> (Duration, T)
    where F: FnOnce() -> T
{
    let before = Instant::now();
    let result = f();
    let after = Instant::now();

    let timing = after.duration_since(before);

    (timing, result)
}

impl Handler for LogHandler {
    fn handle(&self, req: &mut Request) -> IronResult<Response> {
        let (timing, response_result) = time_it(|| self.0.handle(req));

        let status = response_result.as_ref()
            .map(|success| success.status)
            .unwrap_or_else(|failure| failure.response.status);

        println!("URL: {:?}", req.url);
        println!("IP: {:?}", req.remote_addr);
        println!("Status: {:?}", status);
        println!("Timing: {:?}", timing);

        response_result
    }
}
