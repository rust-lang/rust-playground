ARG repository
ARG base_image=${repository}/rust-nightly:sources
FROM ${base_image}

RUN rustup component add rustfmt-preview

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
