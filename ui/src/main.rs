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
use std::io::prelude::*;
use std::io::BufWriter;
use std::fs::File;
use std::process::Command;

use mount::Mount;
use staticfile::Static;
use iron::prelude::*;
use iron::status;

use mktemp::Temp;

const DEFAULT_ADDRESS: &'static str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5000;

fn main() {
    env_logger::init().expect("Unable to initialize logger");

    let root: PathBuf = env::var_os("PLAYGROUND_UI_ROOT").expect("Must specify PLAYGROUND_UI_ROOT").into();
    let address = env::var("PLAYGROUND_UI_ADDRESS").unwrap_or(DEFAULT_ADDRESS.to_string());
    let port = env::var("PLAYGROUND_UI_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT);

    let mut mount = Mount::new();
    mount.mount("/", Static::new(&root));
    mount.mount("/compile", compile);

    info!("Starting the server on {}:{}", address, port);
    Iron::new(mount).http((&*address, port)).expect("Unable to start server");
}

fn compile(req: &mut Request) -> IronResult<Response> {
    match req.get::<bodyparser::Struct<CompileRequest>>() {
        Ok(Some(req)) => {
            Ok(Response::with((status::Ok, do_compile(&req))))
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

fn do_compile(req: &CompileRequest) -> String {
    let scratch_dir = Temp::new_dir().expect("Unable to create temp dir");

    write_source_code(&scratch_dir, &req.code);
    let mut command = compile_command(&scratch_dir);

    let output = command.output().expect("Failed to run");

    let response = CompileResponse {
        success: output.status.success(),
        stdout: String::from_utf8(output.stdout).expect("Stdout was not UTF-8"),
        stderr: String::from_utf8(output.stderr).expect("Stderr was not UTF-8"),
    };

    serde_json::ser::to_string(&response).expect("Can't serialize")
}

fn write_source_code(dir: &Temp, code: &str) {
    let data = code.as_bytes();

    let path = {
        let mut p = dir.to_path_buf();
        p.push("main.rs");
        p
    };

    let file = File::create(&path).expect("Unable to create source code");
    let mut file = BufWriter::new(file);

    file.write_all(data).expect("Unable to write source code");

    debug!("Wrote {} bytes of source to {}", data.len(), path.display());
}

fn compile_command(dir: &Temp) -> Command {
    let utf8_dir = dir.as_ref().to_str().expect("Unable to convert directory to UTF-8");
    let mount_source_volume = format!("--volume={}:/source", utf8_dir);

    let mut cmd = Command::new("docker");

    cmd
        .arg("run")
        .arg(mount_source_volume)
        .arg("rust-stable")
        .arg("bash")
        .arg("-c")
        .arg("source $HOME/.cargo/env; cd /source; rustc main.rs; ./main");

    debug!("Compilation command is {:?}", cmd);

    cmd
}

#[derive(Debug, Clone, Deserialize)]
struct CompileRequest {
    code: String,
}

#[derive(Debug, Clone, Serialize)]
struct CompileResponse {
    success: bool,
    stdout: String,
    stderr: String,
}
