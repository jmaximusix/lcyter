FROM rust:latest as builder

# Build step
WORKDIR /usr/src/lcyter
COPY --link src src
COPY --link Cargo.toml Cargo.toml
# COPY --link rust-toolchain.toml rust-toolchain.toml
RUN cargo install --path .

# Final image
FROM debian:bookworm-slim
EXPOSE 7373
ENV LANG C.UTF-8
WORKDIR /app
COPY public public
COPY --from=builder /usr/local/cargo/bin/lcyter /usr/local/bin/lcyter
ENTRYPOINT ["lcyter"]