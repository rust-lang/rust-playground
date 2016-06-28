# Rust Playground Reimplementation

This is an alternate implementation of the [Rust Playground][play].

[play]: https://play.rust-lang.org/

## Architecture

A React frontend communicates with an Iron backend. Docker containers
are used to provide the various compilers and tool as well as to help
isolate them.

## Resource Limits

### Network

There is no network connection between the compiler container and the
outside world.

### Memory

The amount of memory the compiler and resulting executable use is
limited by the container.

### Execution Time

The total compilation and execution time is limited by the container.

### Disk

This sandbox **does not** provide any disk space limits. It is
suggested to run the server such that the temp directory is a
space-limited. One bad actor may fill up this shared space, but it
should be cleaned when that request ends.

## Deployment

### Amazon EC2

Here's an example session. This could definitely be improved and
automated.

#### Dependencies

```
sudo yum update -y
sudo yum install -y docker git
sudo service docker start
sudo usermod -a -G docker ec2-user
```

#### Set aside disk space
```
sudo dd if=/dev/zero of=/playground.fs bs=1024 count=512000
sudo losetup /dev/loop2 /playground.fs
sudo mkfs -t ext3 -m 1 -v /dev/loop2
sudo mkdir /mnt/vfs
sudo mount -t ext3 /dev/loop2 /mnt/vfs
```

#### Get the code
```
git clone https://github.com/integer32llc/rust-playground.git
cd rust-playground
```

#### Build containers
```
cd compiler/stable
docker build -t rust-stable .
cd ../beta
docker build -t rust-beta .
cd ../nightly
docker build -t rust-nightly .
cd ../rustfmt
docker build -t rustfmt .
cd ../../
```

#### Build the UI backend
```
cd ui
docker run -it --rm -v $PWD:/ui --entrypoint /bin/bash rust-nightly
cd /ui
rustup target add x86_64-unknown-linux-musl
cargo build --target=x86_64-unknown-linux-musl --release
# exit docker
```

#### Build the UI frontend
```
docker run -it --rm -v $PWD/frontend:/ui --entrypoint /bin/bash node
cd /ui
npm install
NODE_ENV=production npm run build
# exit docker
```

#### Run the server
```
sudo \
  TMPDIR=/mnt/vfs \
  RUST_LOG=info \
  PLAYGROUND_UI_ADDRESS=0.0.0.0 \
  PLAYGROUND_UI_PORT=80 \
  PLAYGROUND_UI_ROOT=$PWD/frontend/build \
  ./target/x86_64-unknown-linux-musl/release/ui
```
