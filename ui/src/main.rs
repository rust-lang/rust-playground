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

use sandbox::Sandbox;

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
            let resp = CompileResponse::from(sandbox.compile(&req.into()));
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
            let resp = ExecuteResponse::from(sandbox.execute(&req.into()));
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
            let resp = FormatResponse::from(sandbox.format(&req.into()));
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

#[derive(Debug, Clone, Deserialize)]
struct CompileRequest {
    target: String,
    channel: String,
    mode: String,
    tests: bool,
    code: String,
}

impl From<CompileRequest> for sandbox::CompileRequest {
    fn from(me: CompileRequest) -> Self {
        sandbox::CompileRequest {
            target: parse_target(&me.target),
            channel: parse_channel(&me.channel),
            mode: me.mode,
            tests: me.tests,
            code: me.code,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct CompileResponse {
    success: bool,
    code: String,
    stdout: String,
    stderr: String,
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

#[derive(Debug, Clone, Deserialize)]
struct ExecuteRequest {
    channel: String,
    mode: String,
    tests: bool,
    code: String,
}

impl From<ExecuteRequest> for sandbox::ExecuteRequest {
    fn from(me: ExecuteRequest) -> Self {
        sandbox::ExecuteRequest {
            channel: parse_channel(&me.channel),
            mode: me.mode,
            tests: me.tests,
            code: me.code,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct ExecuteResponse {
    success: bool,
    stdout: String,
    stderr: String,
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

#[derive(Debug, Clone, Deserialize)]
struct FormatRequest {
    code: String,
}

impl From<FormatRequest> for sandbox::FormatRequest {
    fn from(me: FormatRequest) -> Self {
        sandbox::FormatRequest {
            code: me.code,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct FormatResponse {
    success: bool,
    code: String,
    stdout: String,
    stderr: String,
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

fn parse_target(s: &str) -> sandbox::CompileTarget {
    match s {
        "asm" => sandbox::CompileTarget::Assembly,
        "llvm-ir" => sandbox::CompileTarget::LlvmIr,
        _ => panic!("Unknown compilation target {}", s),
    }
}

fn parse_channel(s: &str) -> sandbox::Channel {
    match s {
        "stable" => sandbox::Channel::Stable,
        "beta" => sandbox::Channel::Beta,
        "nightly" => sandbox::Channel::Nightly,
        _ => panic!("Unknown channel {}", s),
    }
}
