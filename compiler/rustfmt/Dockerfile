ARG base_image=shepmaster/rust-nightly
FROM ${base_image}

RUN rustup component add rustfmt

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
