use std::fs::File;
use std::io::prelude::*;
use std::io::{self, BufReader, BufWriter, ErrorKind};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::string;

use mktemp::Temp;

quick_error! {
    #[derive(Debug)]
    pub enum Error {
        UnableToCreateTempDir(err: io::Error) {
            description("unable to create temporary directory")
            display("Unable to create temporary directory: {}", err)
            cause(err)
        }
        UnableToCreateSourceFile(err: io::Error) {
            description("unable to create source file")
            display("Unable to create source file: {}", err)
            cause(err)
        }
        UnableToExecuteCompiler(err: io::Error) {
            description("unable to execute the compiler")
            display("Unable to execute the compiler: {}", err)
            cause(err)
        }
        UnableToReadOutput(err: io::Error) {
            description("unable to read output file")
            display("Unable to read output file: {}", err)
            cause(err)
        }
        OutputNotUtf8(err: string::FromUtf8Error) {
            description("output was not valid UTF-8")
            display("Output was not valid UTF-8: {}", err)
            cause(err)
        }
        OutputMissing {
            description("output was missing")
            display("Output was missing")
        }
    }
}

pub type Result<T> = ::std::result::Result<T, Error>;

pub struct Sandbox {
    scratch_dir: Temp,
}

fn vec_to_str(v: Vec<u8>) -> Result<String> {
    String::from_utf8(v).map_err(Error::OutputNotUtf8)
}

impl Sandbox {
    pub fn new() -> Result<Self> {
        Ok(Sandbox {
            scratch_dir: try!(Temp::new_dir().map_err(Error::UnableToCreateTempDir)),
        })
    }

    pub fn compile(&self, req: &CompileRequest) -> Result<CompileResponse> {
        try!(self.write_source_code(&req.code));

        let mut output_path = self.scratch_dir.as_ref().to_path_buf();
        output_path.push("compiler-output");
        let mut command = self.compile_command(req.target, req.channel, req.mode, req.tests);

        let output = try!(command.output().map_err(Error::UnableToExecuteCompiler));

        Ok(CompileResponse {
            success: output.status.success(),
            code: try!(read(&output_path)).unwrap_or_else(String::new),
            stdout: try!(vec_to_str(output.stdout)),
            stderr: try!(vec_to_str(output.stderr)),
        })
    }

    pub fn execute(&self, req: &ExecuteRequest) -> Result<ExecuteResponse> {
        try!(self.write_source_code(&req.code));
        let mut command = self.execute_command(req.channel, req.mode, req.tests);

        let output = try!(command.output().map_err(Error::UnableToExecuteCompiler));

        Ok(ExecuteResponse {
            success: output.status.success(),
            stdout: try!(vec_to_str(output.stdout)),
            stderr: try!(vec_to_str(output.stderr)),
        })
    }

    pub fn format(&self, req: &FormatRequest) -> Result<FormatResponse> {
        let path = try!(self.write_source_code(&req.code));
        let mut command = self.format_command();

        let output = try!(command.output().map_err(Error::UnableToExecuteCompiler));

        Ok(FormatResponse {
            success: output.status.success(),
            code: try!(try!(read(path.as_path())).ok_or(Error::OutputMissing)),
            stdout: try!(vec_to_str(output.stdout)),
            stderr: try!(vec_to_str(output.stderr)),
        })
    }

    fn write_source_code(&self, code: &str) -> Result<PathBuf> {
        let data = code.as_bytes();

        let path = {
            let mut p = self.scratch_dir.to_path_buf();
            p.push("main.rs");
            p
        };

        let file = try!(File::create(&path).map_err(Error::UnableToCreateSourceFile));
        let mut file = BufWriter::new(file);

        try!(file.write_all(data).map_err(Error::UnableToCreateSourceFile));

        debug!("Wrote {} bytes of source to {}", data.len(), path.display());
        Ok(path)
    }

    fn compile_command(&self, target: CompileTarget, channel: Channel, mode: Mode, tests: bool) -> Command {
        let mut cmd = self.docker_command();

        let execution_cmd = build_execution_command(Some((target, "compiler-output")), mode, tests, "main.rs");

        cmd.arg(&channel.container_name()).args(&["bash", "-c", &execution_cmd]);

        debug!("Compilation command is {:?}", cmd);

        cmd
    }

    fn execute_command(&self, channel: Channel, mode: Mode, tests: bool) -> Command {
        let mut cmd = self.docker_command();

        let mut execution_cmd = build_execution_command(None, mode, tests, "main.rs");
        execution_cmd.push_str(" && ./main");

        cmd.arg(&channel.container_name()).args(&["bash", "-c", &execution_cmd]);

        debug!("Execution command is {:?}", cmd);

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

        let mut mount_source_volume = self.scratch_dir.as_ref().as_os_str().to_os_string();
        mount_source_volume.push(":");
        mount_source_volume.push(DIR_INSIDE_CONTAINER);

        let mut cmd = Command::new("docker");

        cmd
            .arg("run")
            .arg("--volume").arg(&mount_source_volume)
            .args(&["--workdir", DIR_INSIDE_CONTAINER])
            .args(&["--net", "none"])
            .args(&["--memory", "256m"])
            .args(&["--memory-swap", "320m"]);

        cmd
    }
}

fn build_execution_command(target: Option<(CompileTarget, &str)>, mode: Mode, tests: bool, source_file: &str) -> String {
    use self::CompileTarget::*;
    use self::Mode::*;

    let mut s = String::from("rustc");

    match mode {
        Debug => s.push_str(" -g"),
        Release => s.push_str(" -C opt-level=3"),
    }

    if tests {
        s.push_str(" --test");
    }

    if let Some((target, filename)) = target {
        match target {
            Assembly => s.push_str(" --emit asm"),
            LlvmIr => s.push_str(" --emit llvm-ir"),
        }
        s.push_str(" -o ");
        s.push_str(filename);
    }

    s.push_str(" ");
    s.push_str(source_file);

    s
}

fn read(path: &Path) -> Result<Option<String>> {
    let f = match File::open(path) {
        Ok(f) => f,
        Err(ref e) if e.kind() == ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(Error::UnableToReadOutput(e)),
    };
    let mut f = BufReader::new(f);

    let mut s = String::new();
    try!(f.read_to_string(&mut s).map_err(Error::UnableToReadOutput));
    Ok(Some(s))
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum CompileTarget {
    Assembly,
    LlvmIr,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum Channel {
    Stable,
    Beta,
    Nightly,
}

impl Channel {
    fn container_name(&self) -> &'static str {
        use self::Channel::*;

        match *self {
            Stable => "rust-stable",
            Beta => "rust-beta",
            Nightly => "rust-nightly",
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum Mode {
    Debug,
    Release,
}

#[derive(Debug, Clone)]
pub struct CompileRequest {
    pub target: CompileTarget,
    pub channel: Channel,
    pub mode: Mode,
    pub tests: bool,
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct CompileResponse {
    pub success: bool,
    pub code: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct ExecuteRequest {
    pub channel: Channel,
    pub mode: Mode,
    pub tests: bool,
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct ExecuteResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct FormatRequest {
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct FormatResponse {
    pub success: bool,
    pub code: String,
    pub stdout: String,
    pub stderr: String,
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn network_connections_are_disabled() {
        let code = r#"
            fn main() {
                match ::std::net::TcpStream::connect("google.com:80") {
                    Ok(_) => println!("Able to connect to the outside world"),
                    Err(e) => println!("Failed to connect {}, {:?}", e, e),
                }
            }
        "#;

        let req = ExecuteRequest {
            channel: Channel::Stable,
            mode: Mode::Debug,
            tests: false,
            code: code.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("Failed to connect"));
    }

    #[test]
    fn memory_usage_is_limited() {
        let code = r#"
            fn main() {
                let megabyte = 1024 * 1024;
                let mut big = vec![0u8; 384 * megabyte];
                *big.last_mut().unwrap() += 1;
            }
        "#;

        let req = ExecuteRequest {
            channel: Channel::Stable,
            mode: Mode::Debug,
            tests: false,
            code: code.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stderr.contains("Killed"));
        assert!(resp.stderr.contains("./main"));
    }
}
