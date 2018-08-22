FROM shepmaster/rust-nightly as sources

RUN rustup component add rust-src

FROM sources as build

RUN cargo install xargo
RUN git clone https://github.com/solson/miri ~/miri
RUN rm -f ~/miri/rust-toolchain # make sure we use our toolchain
RUN ~/miri/xargo/build.sh
RUN cargo install --all-features --path ~/miri

FROM sources

COPY --from=build /root/.xargo /root/.xargo
COPY --from=build /root/.cargo/bin/miri /root/.cargo/bin
COPY --from=build /root/.cargo/bin/cargo-miri /root/.cargo/bin
ADD cargo-miri-playground /root/.cargo/bin
