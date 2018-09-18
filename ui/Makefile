server:
	./scripts/build-server.sh image

gui:
	./scripts/build-gui.sh

push: server
	./scripts/build-server.sh push

all: gui server push

run:
	docker pull taridocker/rust-playground || true && \
	docker run \
	-p 5000:5000 \
	--name playground \
	-v /var/run/docker.sock:/var/run/docker.sock \
	-v /tmp/playground/:/mnt/playground/ \
	-e RUST_LOG=debug \
	taridocker/rust-playground