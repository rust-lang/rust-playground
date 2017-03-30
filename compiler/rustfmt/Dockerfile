FROM rust-stable

ARG version

RUN cargo install rustfmt --vers "${version}"
RUN mkdir rfc && \
    curl 'https://raw.githubusercontent.com/rust-lang-nursery/rustfmt/master/rfc-rustfmt.toml' \
      -o 'rfc/rustfmt.toml'
