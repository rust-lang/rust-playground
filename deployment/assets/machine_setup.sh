#!/bin/bash

apt update
apt install -y git nginx pkg-config uidmap dbus-user-session

# See https://linuxhandbook.com/install-docker-ubuntu/ for how to install docker and set it up to run without sudo
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y

apt install -y docker-ce docker-ce-cli containerd.io
groupadd docker
usermod -aG docker ubuntu
systemctl enable docker

wget http://nz2.archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1l-1ubuntu1_amd64.deb
sudo dpkg -i libssl1.1_1.1.1l-1ubuntu1_amd64.deb

echo "[Unit]" > /etc/systemd/system/playground.service
echo "Description=The Rust Playground" >> /etc/systemd/system/playground.service
echo "" >> /etc/systemd/system/playground.service
echo "[Service]" >> /etc/systemd/system/playground.service
# echo "Environment=TMPDIR=/mnt/playground" >> /etc/systemd/system/playground.service
echo "Environment=RUST_LOG=info" >> /etc/systemd/system/playground.service
echo "Environment=PLAYGROUND_UI_ROOT=/home/ubuntu/build" >> /etc/systemd/system/playground.service
echo "Environment=PLAYGROUND_GITHUB_TOKEN=/home/ubuntu/build" >> /etc/systemd/system/playground.service
echo "Environment=PLAYGROUND_UI_ADDRESS=0.0.0.0" >> /etc/systemd/system/playground.service
echo "Environment=PLAYGROUND_UI_PORT=8080" >> /etc/systemd/system/playground.service
echo "Environment=PLAYGROUND_UI_ROOT=/home/ubuntu/build" >> /etc/systemd/system/playground.service
echo "Environment=PLAYGROUND_CORS_ENABLED=1" >> /etc/systemd/system/playground.service
echo "" >> /etc/systemd/system/playground.service
echo "WorkingDirectory=/home/ubuntu" >> /etc/systemd/system/playground.service
echo "" >> /etc/systemd/system/playground.service
echo "ExecStart=/home/ubuntu/ui" >> /etc/systemd/system/playground.service
echo "" >> /etc/systemd/system/playground.service
echo "[Install]" >> /etc/systemd/system/playground.service
echo "WantedBy=multi-user.target" >> /etc/systemd/system/playground.service

systemctl enable playground.service

echo "user www-data;" > /etc/nginx/nginx.conf
echo "worker_processes auto;" >> /etc/nginx/nginx.conf
echo "pid /run/nginx.pid;" >> /etc/nginx/nginx.conf
echo "include /etc/nginx/modules-enabled/*.conf;" >> /etc/nginx/nginx.conf
echo "" >> /etc/nginx/nginx.conf
echo "events {" >> /etc/nginx/nginx.conf
echo "    worker_connections 768;" >> /etc/nginx/nginx.conf
echo "}" >> /etc/nginx/nginx.conf
echo "" >> /etc/nginx/nginx.conf
echo "http {" >> /etc/nginx/nginx.conf
echo "    server {" >> /etc/nginx/nginx.conf
echo "        listen 80 default_server;" >> /etc/nginx/nginx.conf
echo "        listen [::]:80 default_server;" >> /etc/nginx/nginx.conf
echo "" >> /etc/nginx/nginx.conf
echo "        location / {" >> /etc/nginx/nginx.conf
echo "            proxy_pass http://localhost:8080;" >> /etc/nginx/nginx.conf
echo "        }" >> /etc/nginx/nginx.conf
echo "    }" >> /etc/nginx/nginx.conf
echo "}" >> /etc/nginx/nginx.conf

systemctl restart nginx