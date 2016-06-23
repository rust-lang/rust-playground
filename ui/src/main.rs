#![feature(custom_derive, plugin)]
#![plugin(serde_macros)]

#[macro_use]
extern crate log;
extern crate env_logger;
extern crate iron;
extern crate mount;
extern crate staticfile;
extern crate bodyparser;
extern crate serde;
extern crate serde_json;
extern crate mktemp;

use std::env;
use std::path::PathBuf;

use mount::Mount;
use staticfile::Static;
use iron::prelude::*;
use iron::status;

use sandbox::{Sandbox, CompileRequest, ExecuteRequest, FormatRequest};

const DEFAULT_ADDRESS: &'static str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5000;

mod sandbox;

fn main() {
    env_logger::init().expect("Unable to initialize logger");

    let root: PathBuf = env::var_os("PLAYGROUND_UI_ROOT").expect("Must specify PLAYGROUND_UI_ROOT").into();
    let address = env::var("PLAYGROUND_UI_ADDRESS").unwrap_or(DEFAULT_ADDRESS.to_string());
    let port = env::var("PLAYGROUND_UI_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT);

    let mut mount = Mount::new();
    mount.mount("/", Static::new(&root));
    mount.mount("/compile", compile);
    mount.mount("/execute", execute);
    mount.mount("/format", format);

    info!("Starting the server on {}:{}", address, port);
    Iron::new(mount).http((&*address, port)).expect("Unable to start server");
}

fn compile(req: &mut Request) -> IronResult<Response> {
    match req.get::<bodyparser::Struct<CompileRequest>>() {
        Ok(Some(req)) => {
            let sandbox = Sandbox::new();
            let resp = sandbox.compile(&req);
            let body = serde_json::ser::to_string(&resp).expect("Can't serialize");

            Ok(Response::with((status::Ok, body)))
        }
        Ok(None) => {
            // TODO: real error
            Ok(Response::with((status::Ok, r#"{ "output": "FAIL1" }"#)))
        },
        Err(_) => {
            // TODO: real error
            Ok(Response::with((status::Ok, r#"{ "output": "FAIL2" }"#)))
        }
    }
}

fn execute(req: &mut Request) -> IronResult<Response> {
    match req.get::<bodyparser::Struct<ExecuteRequest>>() {
        Ok(Some(req)) => {
            let sandbox = Sandbox::new();
            let resp = sandbox.execute(&req);
            let body = serde_json::ser::to_string(&resp).expect("Can't serialize");

            Ok(Response::with((status::Ok, body)))
        }
        Ok(None) => {
            // TODO: real error
            Ok(Response::with((status::Ok, r#"{ "output": "FAIL1" }"#)))
        },
        Err(_) => {
            // TODO: real error
            Ok(Response::with((status::Ok, r#"{ "output": "FAIL2" }"#)))
        }
    }
}

fn format(req: &mut Request) -> IronResult<Response> {
    match req.get::<bodyparser::Struct<FormatRequest>>() {
        Ok(Some(req)) => {
            let sandbox = Sandbox::new();
            let resp = sandbox.format(&req);
            let body = serde_json::ser::to_string(&resp).expect("Can't serialize");
            Ok(Response::with((status::Ok, body)))
        }
        Ok(None) => {
            // TODO: real error
            Ok(Response::with((status::Ok, r#"{ "code": "FAIL1" }"#)))
        },
        Err(_) => {
            // TODO: real error
            Ok(Response::with((status::Ok, r#"{ "code": "FAIL2" }"#)))
        }
    }
}
