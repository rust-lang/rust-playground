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
Playground, it may also inspire more experimentation that would be
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

## Security Hall of Fame

A large set of thanks go to those individuals who have helped by
reporting security holes or other attack vectors against the
Playground. Each report helps us make the Playground better!

* Preliminary sandbox testing (PID limit) by Stefan O'Rear.

If you'd like to perform tests that you think might disrupt service of
the Playground, get in touch and we can create an isolated clone to
perform tests on! Once fixed, you can choose to be credited here.

## Deployment

### Amazon EC2 (Amazon Linux)

Here's an example session. This could definitely be improved and
automated.

#### Dependencies (as root)

```
yum update -y
yum install -y docker git

# Use a production-quality storage driver that doesn't leak disk space
vim /etc/sysconfig/docker
# Add to OPTIONS: --storage-driver=overlay

# Allow controlling the PID limit
vim /etc/cgconfig.conf
# Add:    pids       = /cgroup/pids;

service docker start
usermod -a -G docker ec2-user

fallocate -l 1G /swap.fs
chmod 0600 /swap.fs
mkswap /swap.fs
swapon /swap.fs
```

#### Set aside disk space (as root)
```
fallocate -l 512M /playground.fs
losetup /dev/loop0 /playground.fs
mkfs -t ext3 -m 1 -v /dev/loop0
mkdir /mnt/playground
mount -t ext3 /dev/loop0 /mnt/playground
```

#### Get the code
```
git clone https://github.com/integer32llc/rust-playground.git
cd rust-playground
```

#### Build the containers
```
cd compiler/
./build.sh
cd ../
```

#### Set a crontab to rebuild the containers

```
0 0 * * * cd /home/ec2-user/rust-playground/compiler && ./build.sh
0 * * * * docker images -q --filter "dangling=true" | xargs docker rmi
```

#### Build the UI backend
```
cd ui
docker run -it --rm -v $PWD:/ui --workdir /ui --entrypoint /bin/bash rust-nightly
rustup target add x86_64-unknown-linux-musl
cargo build --target=x86_64-unknown-linux-musl --release
# exit docker
cd ..
```

#### Build the UI frontend
```
cd ui/frontend
docker run -it --rm -v $PWD:/ui --workdir /ui --entrypoint /bin/bash node
npm install -g yarn
yarn
NODE_ENV=production yarn run build
# exit docker
cd ../..
```

#### Run the server
```
cd ui
sudo \
  TMPDIR=/mnt/playground \
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
yarn
yarn run watch # Will rebuild and watch for changes
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
