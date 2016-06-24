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

**TODO**
