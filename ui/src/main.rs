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
use std::path::{Path, PathBuf};
use std::io::prelude::*;
use std::io::{BufReader, BufWriter};
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
    mount.mount("/format", format);

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

fn format(req: &mut Request) -> IronResult<Response> {
    match req.get::<bodyparser::Struct<FormatRequest>>() {
        Ok(Some(req)) => {
            Ok(Response::with((status::Ok, do_format(&req))))
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

fn do_compile(req: &CompileRequest) -> String {
    let scratch_dir = Temp::new_dir().expect("Unable to create temp dir");

    write_source_code(&scratch_dir, &req.code);
    let mut command = compile_command(&scratch_dir, &req.channel);

    let output = command.output().expect("Failed to run");

    let response = CompileResponse {
        success: output.status.success(),
        stdout: String::from_utf8(output.stdout).expect("Stdout was not UTF-8"),
        stderr: String::from_utf8(output.stderr).expect("Stderr was not UTF-8"),
    };

    serde_json::ser::to_string(&response).expect("Can't serialize")
}

fn do_format(req: &FormatRequest) -> String {
    let scratch_dir = Temp::new_dir().expect("Unable to create temp dir");

    let path = write_source_code(&scratch_dir, &req.code);
    let mut command = format_command(&scratch_dir);

    let output = command.output().expect("Failed to run");

    let response = FormatResponse {
        success: output.status.success(),
        code: read(path.as_path()),
        stdout: String::from_utf8(output.stdout).expect("Stdout was not UTF-8"),
        stderr: String::from_utf8(output.stderr).expect("Stderr was not UTF-8"),
    };

    serde_json::ser::to_string(&response).expect("Can't serialize")
}

fn read(path: &Path) -> String {
    let f = File::open(path).expect("Couldn't open");
    let mut f = BufReader::new(f);

    let mut s = String::new();
    f.read_to_string(&mut s).expect("Couldn't read");
    s
}

fn write_source_code(dir: &Temp, code: &str) -> PathBuf {
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
    path
}

fn compile_command(dir: &Temp, channel: &str) -> Command {
    let utf8_dir = dir.as_ref().to_str().expect("Unable to convert directory to UTF-8");
    let mount_source_volume = format!("{}:/source", utf8_dir);

    let container = format!("rust-{}", channel);

    let mut cmd = Command::new("docker");

    cmd
        .arg("run")
        .args(&["--volume", &mount_source_volume])
        .args(&["--workdir", "/source"])
        .arg(&container)
        .args(&["bash", "-c", r#"rustc main.rs && ./main"#]);

    debug!("Compilation command is {:?}", cmd);

    cmd
}

fn format_command(dir: &Temp) -> Command {
    let utf8_dir = dir.as_ref().to_str().expect("Unable to convert directory to UTF-8");
    let mount_source_volume = format!("{}:/source", utf8_dir);

    let mut cmd = Command::new("docker");

    cmd
        .arg("run")
        .args(&["--volume", &mount_source_volume])
        .args(&["--workdir", "/source"])
        .arg("rustfmt")
        .args(&["main.rs"]);

    debug!("Formatting command is {:?}", cmd);

    cmd
}

#[derive(Debug, Clone, Deserialize)]
struct CompileRequest {
    channel: String,
    code: String,
}

#[derive(Debug, Clone, Serialize)]
struct CompileResponse {
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Deserialize)]
struct FormatRequest {
    code: String,
}

#[derive(Debug, Clone, Serialize)]
struct FormatResponse {
    success: bool,
    code: String,
    stdout: String,
    stderr: String,
}
