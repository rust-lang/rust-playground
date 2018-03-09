use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fmt;
use std::fs::{self, File};
use std::io::prelude::*;
use std::io::{self, BufReader, BufWriter, ErrorKind};
use std::path::Path;
use std::process::Command;
use std::string;

#[derive(Debug, Deserialize)]
struct CrateInformationInner {
    name: String,
    version: String,
    id: String,
}

#[derive(Debug, Clone)]
pub struct CrateInformation {
    pub name: String,
    pub version: String,
    pub id: String,
}

impl From<CrateInformationInner> for CrateInformation {
    fn from(me: CrateInformationInner) -> Self {
        let CrateInformationInner { name, version, id } = me;
        Self { name, version, id }
    }
}

#[derive(Debug, Clone)]
pub struct Version {
    pub release: String,
    pub commit_hash: String,
    pub commit_date: String,
}

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
        UnableToParseCrateInformation(err: ::serde_json::Error) {
            from()
            description("unable to read crate information")
            display("Unable to read crate information: {}", err)
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
        VersionReleaseMissing {
            description("release was missing from the version output")
            display("Release was missing from the version output")
        }
        VersionHashMissing {
            description("commit hash was missing from the version output")
            display("Commit hash was missing from the version output")
        }
        VersionDateMissing {
            description("commit date was missing from the version output")
            display("Commit date was missing from the version output")
        }
    }
}

pub type Result<T> = ::std::result::Result<T, Error>;

pub struct Sandbox {
    input_file: Temp,
    output_dir: Temp,
}

fn vec_to_str(v: Vec<u8>) -> Result<String> {
    String::from_utf8(v).map_err(Error::OutputNotUtf8)
}

impl Sandbox {
    pub fn new() -> Result<Self> {
        Ok(Sandbox {
            input_file: try!(Temp::new_file().map_err(Error::UnableToCreateTempDir)),
            output_dir: try!(Temp::new_dir().map_err(Error::UnableToCreateTempDir)),
        })
    }

    pub fn compile(&self, req: &CompileRequest) -> Result<CompileResponse> {
        try!(self.write_source_code(&req.code));

        let mut command = self.compile_command(req.target, req.channel, req.mode, req.crate_type, req.tests, &req.compiler_flags);

        let output = try!(command.output().map_err(Error::UnableToExecuteCompiler));

        let result_path = self.output_dir.as_ref();

        // The compiler writes the file to a name like
        // `compilation-3b75174cac3d47fb.ll`, so we just find the
        // first with the right extension.
        let file =
            fs::read_dir(&result_path)
            .map_err(Error::UnableToReadOutput)?
            .flat_map(|entry| entry)
            .map(|entry| entry.path())
            .find(|path| path.extension() == Some(req.target.extension()));

        let stdout = vec_to_str(output.stdout)?;
        let mut stderr = vec_to_str(output.stderr)?;

        let mut code = match file {
            Some(file) => read(&file)?.unwrap_or_else(String::new),
            None => {
                // If we didn't find the file, it's *most* likely that
                // the user's code was invalid. Tack on our own error
                // to the compiler's error instead of failing the
                // request.
                use self::fmt::Write;
                write!(&mut stderr, "\nUnable to locate file for {} output", req.target)
                    .expect("Unable to write to a string");
                String::new()
            }
        };

        if let CompileTarget::Assembly(_, demangle, process) = req.target {

            if demangle == DemangleAssembly::Demangle {
                code = super::asm_cleanup::demangle_asm(&code);
            }

            if process == ProcessAssembly::Filter {
                code = super::asm_cleanup::filter_asm(&code);
            }
        }

        Ok(CompileResponse {
            success: output.status.success(),
            code,
            stdout,
            stderr,
        })
    }

    pub fn execute(&self, req: &ExecuteRequest) -> Result<ExecuteResponse> {
        try!(self.write_source_code(&req.code));
        let mut command = self.execute_command(req.channel, req.mode, req.crate_type, req.tests);

        let output = try!(command.output().map_err(Error::UnableToExecuteCompiler));

        Ok(ExecuteResponse {
            success: output.status.success(),
            stdout: try!(vec_to_str(output.stdout)),
            stderr: try!(vec_to_str(output.stderr)),
        })
    }

    pub fn format(&self, req: &FormatRequest) -> Result<FormatResponse> {
        try!(self.write_source_code(&req.code));
        let mut command = self.format_command();

        let output = try!(command.output().map_err(Error::UnableToExecuteCompiler));

        Ok(FormatResponse {
            success: output.status.success(),
            code: try!(try!(read(self.input_file.as_ref())).ok_or(Error::OutputMissing)),
            stdout: try!(vec_to_str(output.stdout)),
            stderr: try!(vec_to_str(output.stderr)),
        })
    }

    pub fn clippy(&self, req: &ClippyRequest) -> Result<ClippyResponse> {
        try!(self.write_source_code(&req.code));
        let mut command = self.clippy_command();

        let output = try!(command.output().map_err(Error::UnableToExecuteCompiler));

        Ok(ClippyResponse {
            success: output.status.success(),
            stdout: try!(vec_to_str(output.stdout)),
            stderr: try!(vec_to_str(output.stderr)),
        })
    }

    pub fn crates(&self) -> Result<Vec<CrateInformation>> {
        let mut command = basic_secure_docker_command();
        command.args(&[Channel::Stable.container_name()]);
        command.args(&["cat", "crate-information.json"]);

        let output = command.output().map_err(Error::UnableToExecuteCompiler)?;

        let cargo_toml: Vec<CrateInformationInner> = ::serde_json::from_slice(&output.stdout)?;

        let crates = cargo_toml.into_iter()
            .map(Into::into)
            .collect();

        Ok(crates)
    }

    pub fn version(&self, channel: Channel) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&[channel.container_name()]);
        command.args(&["rustc", "--version", "--verbose"]);

        let output = command.output().map_err(Error::UnableToExecuteCompiler)?;
        let version_output = vec_to_str(output.stdout)?;

        let mut info: BTreeMap<String, String> = version_output.lines().skip(1).filter_map(|line| {
            let mut pieces = line.splitn(2, ':').fuse();
            match (pieces.next(), pieces.next()) {
                (Some(name), Some(value)) => Some((name.trim().into(), value.trim().into())),
                _ => None
            }
        }).collect();

        let release = info.remove("release").ok_or(Error::VersionReleaseMissing)?;
        let commit_hash = info.remove("commit-hash").ok_or(Error::VersionHashMissing)?;
        let commit_date = info.remove("commit-date").ok_or(Error::VersionDateMissing)?;

        Ok(Version { release, commit_hash, commit_date })
    }

    fn write_source_code(&self, code: &str) -> Result<()> {
        let data = code.as_bytes();

        let path = self.input_file.as_ref();
        let file = try!(File::create(path).map_err(Error::UnableToCreateSourceFile));
        let mut file = BufWriter::new(file);

        try!(file.write_all(data).map_err(Error::UnableToCreateSourceFile));

        debug!("Wrote {} bytes of source to {}", data.len(), path.display());
        Ok(())
    }

    fn compile_command(&self, target: CompileTarget, channel: Channel, mode: Mode, crate_type: CrateType, tests: bool, flags: &Option<Vec<String>>) -> Command {
        let mut cmd = self.docker_command(Some(crate_type));

        let execution_cmd = build_execution_command(Some(target), mode, crate_type, tests, &flags);

        cmd.arg(&channel.container_name()).args(&execution_cmd);

        debug!("Compilation command is {:?}", cmd);

        cmd
    }

    fn execute_command(&self, channel: Channel, mode: Mode, crate_type: CrateType, tests: bool) -> Command {
        let mut cmd = self.docker_command(Some(crate_type));

        let execution_cmd = build_execution_command(None, mode, crate_type, tests, &None);

        cmd.arg(&channel.container_name()).args(&execution_cmd);

        debug!("Execution command is {:?}", cmd);

        cmd
    }

    fn format_command(&self) -> Command {
        let crate_type = CrateType::Binary;

        let mut cmd = self.docker_command(Some(crate_type));

        cmd.arg("rustfmt").args(&["cargo", "fmt", "--", "--write-mode", "overwrite"]);

        debug!("Formatting command is {:?}", cmd);

        cmd
    }

    fn clippy_command(&self) -> Command {
        let mut cmd = self.docker_command(None);

        cmd.arg("clippy").args(&["cargo", "clippy"]);

        debug!("Clippy command is {:?}", cmd);

        cmd
    }

    fn docker_command(&self, crate_type: Option<CrateType>) -> Command {
        let crate_type = crate_type.unwrap_or(CrateType::Binary);

        let mut mount_input_file = self.input_file.as_ref().as_os_str().to_os_string();
        mount_input_file.push(":");
        mount_input_file.push("/playground/");
        mount_input_file.push(crate_type.file_name());

        let mut mount_output_dir = self.output_dir.as_ref().as_os_str().to_os_string();
        mount_output_dir.push(":");
        mount_output_dir.push("/playground-result");

        let mut cmd = basic_secure_docker_command();

        cmd
            .arg("--volume").arg(&mount_input_file)
            .arg("--volume").arg(&mount_output_dir);

        cmd
    }
}

fn basic_secure_docker_command() -> Command {
    let mut cmd = Command::new("docker");

    cmd
        .arg("run")
        .arg("--rm")
        .arg("--cap-drop=ALL")
        .arg("--cap-add=DAC_OVERRIDE")
        .arg("--security-opt=no-new-privileges")
        .args(&["--workdir", "/playground"])
        .args(&["--net", "none"])
        .args(&["--memory", "256m"])
        .args(&["--memory-swap", "320m"])
        .args(&["--env", "PLAYGROUND_TIMEOUT=10"]);

    if cfg!(feature = "fork-bomb-prevention") {
        cmd.args(&["--pids-limit", "512"]);
    }

    cmd
}

fn build_execution_command<'a>(target: Option<CompileTarget>, mode: Mode, crate_type: CrateType, tests: bool, compiler_flags: &'a Option<Vec<String>>) -> Vec<&str> {
    use self::CompileTarget::*;
    use self::CrateType::*;
    use self::Mode::*;

    let mut cmd = vec!["cargo"];

    match (target, crate_type, tests) {
        (Some(Wasm), _, _) => cmd.push("wasm"),
        (Some(_), _, _)    => cmd.push("rustc"),
        (_, _, true)       => cmd.push("test"),
        (_, Library, _)    => cmd.push("build"),
        (_, _, _)          => cmd.push("run"),
    }

    if mode == Release {
        cmd.push("--release");
    }

    if let Some(target) = target {
        cmd.extend(&["--", "-o", "/playground-result/compilation"]);

        match target {
            Assembly(flavor, _, _) => {
                use self::AssemblyFlavor::*;

                cmd.push("--emit=asm");

                cmd.push("-C");
                match flavor {
                    Att => cmd.push("llvm-args=-x86-asm-syntax=att"),
                    Intel => cmd.push("llvm-args=-x86-asm-syntax=intel"),
                }
            },
            LlvmIr => cmd.push("--emit=llvm-ir"),
            Mir => cmd.push("--emit=mir"),
            Wasm => { /* handled by cargo-wasm wrapper */ },
         }
    }

    if let Some(ref flags) = *compiler_flags {
        for f in flags {
            cmd.push(f.as_str());
        }
    }

    cmd
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
pub enum AssemblyFlavor {
    Att,
    Intel,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum DemangleAssembly {
    Demangle,
    Mangle,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum ProcessAssembly {
    Filter,
    Raw,
}
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum CompileTarget {
    Assembly(AssemblyFlavor, DemangleAssembly, ProcessAssembly),
    LlvmIr,
    Mir,
    Wasm,
}

impl CompileTarget {
    fn extension(&self) -> &'static OsStr {
        let ext = match *self {
            CompileTarget::Assembly(_, _, _) => "s",
            CompileTarget::LlvmIr            => "ll",
            CompileTarget::Mir               => "mir",
            CompileTarget::Wasm              => "wat",
        };
        OsStr::new(ext)
    }
}

impl fmt::Display for CompileTarget {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        use self::CompileTarget::*;

        match *self {
            Assembly(_, _, _) => "assembly".fmt(f),
            LlvmIr            => "LLVM IR".fmt(f),
            Mir               => "Rust MIR".fmt(f),
            Wasm              => "WebAssembly".fmt(f),
        }
    }
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

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum CrateType {
    Binary,
    Library,
}

impl CrateType {
    fn file_name(&self) -> &'static str {
        use self::CrateType::*;

        match *self {
            Binary => "src/main.rs",
            Library => "src/lib.rs",
        }
    }
}

#[derive(Debug, Clone)]
pub struct CompileRequest {
    pub target: CompileTarget,
    pub channel: Channel,
    pub crate_type: CrateType,
    pub mode: Mode,
    pub tests: bool,
    pub code: String,
    pub compiler_flags: Option<Vec<String>>,
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
    pub crate_type: CrateType,
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

#[derive(Debug, Clone)]
pub struct ClippyRequest {
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct ClippyResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[cfg(test)]
mod test {
    use super::*;

    const HELLO_WORLD_CODE: &'static str = r#"
    fn main() {
        println!("Hello, world!");
    }
    "#;

    #[test]
    fn basic_functionality() {
        let req = ExecuteRequest {
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: HELLO_WORLD_CODE.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("Hello, world!"));
    }

    const COMPILATION_MODE_CODE: &'static str = r#"
    #[cfg(debug_assertions)]
    fn main() {
        println!("Compiling in debug mode");
    }

    #[cfg(not(debug_assertions))]
    fn main() {
        println!("Compiling in release mode");
    }
    "#;

    #[test]
    fn debug_mode() {
        let req = ExecuteRequest {
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: COMPILATION_MODE_CODE.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("debug mode"));
    }

    #[test]
    fn release_mode() {
        let req = ExecuteRequest {
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Release,
            tests: false,
            code: COMPILATION_MODE_CODE.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("release mode"));
    }

    static VERSION_CODE: &'static str = r#"
    use std::process::Command;

    fn main() {
        let output = Command::new("rustc").arg("--version").output().unwrap();
        let output = String::from_utf8(output.stdout).unwrap();
        println!("{}", output);
    }
    "#;

    #[test]
    fn stable_channel() {
        let req = ExecuteRequest {
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: VERSION_CODE.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("rustc"));
        assert!(!resp.stdout.contains("beta"));
        assert!(!resp.stdout.contains("nightly"));
    }

    #[test]
    fn beta_channel() {
        let req = ExecuteRequest {
            channel: Channel::Beta,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: VERSION_CODE.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("rustc"));
        assert!(resp.stdout.contains("beta"));
        assert!(!resp.stdout.contains("nightly"));
    }

    #[test]
    fn nightly_channel() {
        let req = ExecuteRequest {
            channel: Channel::Nightly,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: VERSION_CODE.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("rustc"));
        assert!(!resp.stdout.contains("beta"));
        assert!(resp.stdout.contains("nightly"));
    }

    #[test]
    fn output_llvm_ir() {
        let req = CompileRequest {
            target: CompileTarget::LlvmIr,
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: HELLO_WORLD_CODE.to_string(),
            compiler_flags: None,
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");

        assert!(resp.code.contains("ModuleID"));
        assert!(resp.code.contains("target datalayout"));
        assert!(resp.code.contains("target triple"));
    }

    #[test]
    fn output_assembly() {
        let req = CompileRequest {
            target: CompileTarget::Assembly(AssemblyFlavor::Att, DemangleAssembly::Mangle, ProcessAssembly::Raw),
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: HELLO_WORLD_CODE.to_string(),
            compiler_flags: None,
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");

        assert!(resp.code.contains(".text"));
        assert!(resp.code.contains(".file"));
        assert!(resp.code.contains(".section"));
        assert!(resp.code.contains(".p2align"));
    }

    #[test]
    fn output_demangled_assembly() {
        let req = CompileRequest {
            target: CompileTarget::Assembly(AssemblyFlavor::Att, DemangleAssembly::Demangle, ProcessAssembly::Raw),
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: HELLO_WORLD_CODE.to_string(),
            compiler_flags: None,
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");

        assert!(resp.code.contains("core::fmt::Arguments::new_v1"));
        assert!(resp.code.contains("std::io::stdio::_print@PLT"));
    }

    #[test]
    #[should_panic]
    fn output_filtered_assembly() {
        let req = CompileRequest {
            target: CompileTarget::Assembly(AssemblyFlavor::Att, DemangleAssembly::Mangle, ProcessAssembly::Filter),
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: HELLO_WORLD_CODE.to_string(),
            compiler_flags: None,
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");
        
        assert!(resp.code.contains(".text"));
        assert!(resp.code.contains(".file"));
    }

    #[test]
    fn formatting_code() {
        let req = FormatRequest {
            code: "fn foo () { method_call(); }".to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.format(&req).expect("Unable to format code");

        let lines: Vec<_> = resp.code.lines().collect();

        assert_eq!(lines[0], "fn foo() {");
        assert_eq!(lines[1], "    method_call();");
        assert_eq!(lines[2], "}");
    }

    #[test]
    fn linting_code() {
        let code = r#"
        fn main() {
            let a = 0.0 / 0.0;
            println!("NaN is {}", a);
        }
        "#;

        let req = ClippyRequest {
            code: code.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.clippy(&req).expect("Unable to lint code");

        assert!(resp.stderr.contains("warn(eq_op)"));
        assert!(resp.stderr.contains("warn(zero_divided_by_zero)"));
    }

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
            crate_type: CrateType::Binary,
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
            crate_type: CrateType::Binary,
            tests: false,
            code: code.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stderr.contains("Killed"));
    }

    #[test]
    fn wallclock_time_is_limited() {
        let code = r#"
            fn main() {
                let a_long_time = std::time::Duration::from_secs(20);
                std::thread::sleep(a_long_time);
            }
        "#;

        let req = ExecuteRequest {
            channel: Channel::Stable,
            mode: Mode::Debug,
            crate_type: CrateType::Binary,
            tests: false,
            code: code.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stderr.contains("Killed"));
    }

    #[test]
    fn number_of_pids_is_limited() {
        let forkbomb = r##"
            fn main() {
                ::std::process::Command::new("sh").arg("-c").arg(r#"
                    z() {
                        z&
                        z
                    }
                    z
                "#).status().unwrap();
            }
        "##;

        let req = ExecuteRequest {
            channel: Channel::Stable,
            mode: Mode::Debug,
            crate_type: CrateType::Binary,
            tests: false,
            code: forkbomb.to_string(),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stderr.contains("Cannot fork"));
    }

    #[test]
    fn compiler_flags() {
        let req = CompileRequest {
            target: CompileTarget::LlvmIr,
            channel: Channel::Nightly,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            tests: false,
            code: HELLO_WORLD_CODE.to_string(),
            compiler_flags: Some(vec![String::from("-Z"), String::from("time-passes")]),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("time:"));
        assert!(resp.stdout.contains("rss:"));
    }
}
