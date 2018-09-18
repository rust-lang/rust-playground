#!/usr/bin/env bash

# Run this script as root

# Install Docker CE
apt-get update && apt-get upgrade -y && apt-get install -y git awscli nginx
apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -

add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
apt-get update
apt-get install -y docker-ce

usermod -aG docker ubuntu # user needs to log out and in again

#fallocate -l 1G /swap.fs
#sudo chmod 0600 /swap.fs
#sudo mkswap /swap.fs

# Allocate playground disk space
fallocate -l 256M /playground.fs
device=$(losetup -f --show /playground.fs)
mkfs -t ext3 -m 1 -v $device
mkdir /mnt/playground

cat >>/etc/fstab <<EOF
# /swap.fs        none            swap   sw       0   0
/playground.fs /mnt/playground  ext3   loop     0   0
EOF

for image in rust-stable rust-beta rust-nightly rust-fmt rust-playground; do
  docker pull taridocker/$image
  docker tag taridocker/$image $image
done


echo "Docker has been setup. Reboot the instance"