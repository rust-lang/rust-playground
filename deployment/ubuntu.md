### Amazon EC2 (Ubuntu)

Here's an example session. This could definitely be improved and automated.

#### Environment variables

| ENVAR   | Description                                                                  |
|:--------|:-----------------------------------------------------------------------------|
| EC2_URL | The url to the EC2 instance, e.g. `ec2-21-21-198-01.compute-1.amazonaws.com` |

#### Dependencies (as root)

```
apt-get update && apt-get upgrade -y && apt-get install -y git awscli nginx

# Install Docker CE
# Configure apt-get per instructions
# https://docs.docker.com/engine/installation/linux/docker-ce/ubuntu/

sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
sudo apt-get update
    
sudo apt-get install -y docker-ce

# Ensure Docker can control the PID limit
mount | grep cgroup/pids

# Ensure Docker can control swap limit
# https://docs.docker.com/engine/installation/linux/linux-postinstall/#your-kernel-does-not-support-cgroup-swap-limit-capabilities

service docker restart
sudo usermod -aG docker ubuntu # user needs to log out and in again

sudo fallocate -l 1G /swap.fs
sudo chmod 0600 /swap.fs
sudo mkswap /swap.fs
```

#### Set aside disk space (as root)
```
sudo fallocate -l 512M /playground.fs
device=$(sudo losetup -f --show /playground.fs)
sudo mkfs -t ext3 -m 1 -v $device
sudo mkdir /mnt/playground
```

#### Configure disk mountpoints (as root)
```
cat >>/etc/fstab <<EOF
/swap.fs        none            swap   sw       0   0
/playground.fs /mnt/playground  ext3   loop     0   0
EOF
```

Reboot the instance at this point.

#### Get images
```
git clone https://github.com/tari-labs/rust-playground.git
cd rust-playground

sudo apt install cargo libssl-dev pkg-config
```

#### Set a crontab to update the assets, binary, and docker containers

```
crontab -e
```

```
0 0 * * * cd /home/ubuntu/rust-playground/compiler && ./build.sh
0 * * * * docker images -q --filter "dangling=true" | xargs docker rmi
```

Review the [example crontab](crontab) in this repo. It calls [`update.sh`](update.sh) also in this repo.

#### Install the SystemD service

[playground.service](playground.service)

```
cp playground.service /etc/systemd/system/playground.service
service playground start
systemctl enable playground.service
```

#### Install the Nginx reverse proxy

[playground-reverse-proxy](playground-reverse-proxy)

```
cp playground-reverse-proxy /etc/nginx/sites-enabled
service nginx reload
```
