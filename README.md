# Rust Playground Reimplementation

This is an [alternate implementation of the Rust Playground][us].

[us]: http://play.integer32.com/

## Why?

At one point, the [official Rust Playground][play] lost the ability to
run [rustfmt][rustfmt], which is a key piece of functionality for
me. It also utilized a less-common sandboxing technology.

I saw this as a chance to re-implement the Playground in a new tech
stack, both as a learning opportunity and as encouragement for other
people to contribute using technology they are already familiar with.

Since then, the official Playground has re-enabled rustfmt and now
uses [Docker][docker], but I hope that the frontend stack is more
comfortable to potential contributors. Because this is the unofficial
playground, it may also inspire more experimentation that would be
harder to do in an established piece of software.

[play]: https://play.rust-lang.org/
[rustfmt]: https://github.com/rust-lang-nursery/rustfmt

## Architecture

A [React][react] frontend communicates with an [Iron][iron]
backend. [Docker][docker] containers are used to provide the various
compilers and tool as well as to help isolate them.

[react]: https://facebook.github.io/react/
[iron]: http://ironframework.io/
[docker]: https://www.docker.com/

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
cd compiler/
./build.sh
cd ../
```

#### Build the UI backend
```
cd ui
docker run -it --rm -v $PWD:/ui --workdir /ui --entrypoint /bin/bash rust-nightly
rustup target add x86_64-unknown-linux-musl
cargo build --target=x86_64-unknown-linux-musl --release
# exit docker
```

#### Build the UI frontend
```
docker run -it --rm -v $PWD/frontend:/ui --workdir /ui --entrypoint /bin/bash node
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

## Development

### Build the UI
```
cd ui/frontend
npm install
npm run watch # Will rebuild and watch for changes
```

If you don't need the backend running because you are only making
basic HTML/CSS/JS changes, directly open in your browser the built
`ui/frontend/build/index.html`.

### Build and run the server
```
cd ui
RUST_LOG=ui=debug \
PLAYGROUND_UI_ROOT=$PWD/frontend/build/ \
cargo run
```

### Build the containers
```
cd compiler
./build.sh
```
