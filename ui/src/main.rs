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

struct Sandbox {
    scratch_dir: Temp,
}

impl Sandbox {
    fn new() -> Self {
        Sandbox {
            scratch_dir: Temp::new_dir().expect("Unable to create temp dir"),
        }
    }

    pub fn compile(&self, req: &CompileRequest) -> CompileResponse {
        self.write_source_code(&req.code);
        let mut command = self.compile_command(&req.channel);

        let output = command.output().expect("Failed to run");

        CompileResponse {
            success: output.status.success(),
            stdout: String::from_utf8(output.stdout).expect("Stdout was not UTF-8"),
            stderr: String::from_utf8(output.stderr).expect("Stderr was not UTF-8"),
        }
    }

    pub fn format(&self, req: &FormatRequest) -> FormatResponse {
        let path = self.write_source_code(&req.code);
        let mut command = self.format_command();

        let output = command.output().expect("Failed to run");

        FormatResponse {
            success: output.status.success(),
            code: read(path.as_path()),
            stdout: String::from_utf8(output.stdout).expect("Stdout was not UTF-8"),
            stderr: String::from_utf8(output.stderr).expect("Stderr was not UTF-8"),
        }
    }

    fn write_source_code(&self, code: &str) -> PathBuf {
        let data = code.as_bytes();

        let path = {
            let mut p = self.scratch_dir.to_path_buf();
            p.push("main.rs");
            p
        };

        let file = File::create(&path).expect("Unable to create source code");
        let mut file = BufWriter::new(file);

        file.write_all(data).expect("Unable to write source code");

        debug!("Wrote {} bytes of source to {}", data.len(), path.display());
        path
    }

    fn compile_command(&self, channel: &str) -> Command {
        let container = format!("rust-{}", channel);
        let mut cmd = self.docker_command();

        cmd.arg(&container).args(&["bash", "-c", r#"rustc main.rs && ./main"#]);

        debug!("Compilation command is {:?}", cmd);

        cmd
    }

    fn format_command(&self) -> Command {
        let mut cmd = self.docker_command();

        cmd.arg("rustfmt").args(&["main.rs"]);

        debug!("Formatting command is {:?}", cmd);

        cmd
    }

    fn docker_command(&self) -> Command {
        const DIR_INSIDE_CONTAINER: &'static str = "/source";

        let utf8_dir = self.scratch_dir.as_ref().to_str().expect("Unable to convert directory to UTF-8");
        let mount_source_volume = format!("{}:{}", utf8_dir, DIR_INSIDE_CONTAINER);

        let mut cmd = Command::new("docker");

        cmd
            .arg("run")
            .args(&["--volume", &mount_source_volume])
            .args(&["--workdir", DIR_INSIDE_CONTAINER]);

        cmd
    }
}

fn read(path: &Path) -> String {
    let f = File::open(path).expect("Couldn't open");
    let mut f = BufReader::new(f);

    let mut s = String::new();
    f.read_to_string(&mut s).expect("Couldn't read");
    s
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
