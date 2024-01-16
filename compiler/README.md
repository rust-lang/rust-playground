# Rustpen sandbox

The Rustpen sandox is a docker image that is used to compile and run rust code in a safe environment.
The `dockerfile` manifest builds the following components:

* toolchain: Rust compiler. By default, `nightly` is installed, but you can set the `channel` arg to change this.
* bare sources: Built on `toolchain`, this layer initializes a Rust project using the `Cargo-docker.toml` as a 
  template for the manifest. `cargo fetch` downloads all dependencies and caches them in this layer. 
  `Cargo-docker.toml` is auto-generated and lists all the dependencies that are available in the sandbox. This list 
  is updated by running the `tari-deps` binary. `crate-information.json` is also auto-generated and is returned in 
  the `/meta/crates` endpoint. It contains information about all the crates that are available in the sandbox. 
* munge: This layer is built on `bare sources` and builds the `modify-cargo-toml` binary.
* chef-available: install cargo chef
* prepare-orchestrator: This layer is built on `chef-available` runs `cargo chef prepare` on the source code of 
  `asm-cleanup`, `modify-cargo-toml` and `orchestrator`.
* build-orchestrator: uses the recipe created in `prepare-orchestrator` to build the `orchestrator` dependencies, 
  and builds _and installs_ the orchestrator binary.
* sources: Built from `bare sources`, copies the `modify-cargo-toml` binary from `munge` and the orchestrator binary 
  (`.cargo/bin/worker`) into `.cargo/bin`.
* The final image is built on `sources` and runs `cargo build` and `cargo build --release` so that the dependencies 
  are pre-built. 

What's left is essentially a Rust build environment with all the crates that Tari depends on pre-built and cached.

## Running code

To run code in this environment, we need to do the following:
* Mount our `main.rs` as a volume into the appropriate build container (nightly, stable).
* Modify the Cargo.toml file (via `modify-cargo-toml`).
* Compile the code using `cargo build --{mode}`, where `mode` is "release" or "debug".
* Capture the output (and/or build log) by redirecting `stdout` and `stderr` to a file.
* Return the output to the user by mounting the output as a volume.

This is done by the `sandbox` module in the api folder. 

# Troubleshooting
                 
## Permission issues when building docker image (Ubuntu)
```
 Step 15/51 : RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --default-toolchain "${channel}"
 ---> Running in 1b2d3354f741
info: downloading installer
error: could not create bin directory: '/playground/.cargo/bin': Permission denied (os error 13)
```

### Solution

You're running the wrong docker version.

1. First, [completely remove docker](https://www.golinuxcloud.com/ubuntu-uninstall-docker/)
2. Then [install the official docker package](https://docs.docker.com/engine/install/ubuntu/).

## Cannot run docker as user

```
docker build .
ERROR: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Get "http://%2Fvar%2Frun%2Fdocker.sock/_ping": dial unix /var/run/docker.sock: connect: permission denied
```

### Solution

Docker is not configured to run as a non-root user. 
Follow the instructions [here](https://docs.docker.com/engine/install/linux-postinstall/) to configure docker to run as a non-root user.
