#!/bin/bash
set -e

export AWS_DEFAULT_REGION=us-west-2

SCRIPT_DIR=$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)

AMI_ID=$(aws ec2 describe-images \
 --owner 099720109477 \
 --filters Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-*-amd64* \
 --query 'Images[*].[ImageId,CreationDate]' --output text \
 | sort -k2 -r \
 | head -n1 \
 | sed -e "s/\t.*//")

echo "Using AMI ID ${AMI_ID}"

echo "Using device mappings:"
cat $SCRIPT_DIR/mappings.json

INSTANCE_ID="$(aws ec2 run-instances \
 --image-id $AMI_ID \
 --count 1 \
 --instance-type c5.2xlarge \
 --key-name $EC2_KEY_PAIR \
 --tag-specifications 'ResourceType=instance,Tags=[{Key=playground,Value=production}]' \
 --user-data file://$SCRIPT_DIR/machine_setup.sh \
 --block-device-mappings file://$SCRIPT_DIR/mappings.json \
 | jq -r '.Instances[0].InstanceId')"

echo "Waiting on ${INSTANCE_ID}"

aws ec2 wait instance-status-ok --instance-ids $INSTANCE_ID

INSTANCE_DATA="$(aws ec2 describe-instances --instance-id $INSTANCE_ID)"

IPV4_ADDR="$(echo $INSTANCE_DATA | jq -r '.Reservations[0].Instances[0].PublicIpAddress')"

echo "Instance online at IP Address ${IPV4_ADDR}"
echo "Deploying artifacts..."

# Get the keypair secret key and write it to an identity file.
# Ideally, scp would be able to read an identity from an environment
# variable so no credentials would persist on disk, but this is
# not the case. Copy the files to the remote agent
#
# ENVVARS mess with newline formatting, so we have to do a bunch
# of munging to emit the data in the correct format.
echo "-----BEGIN RSA PRIVATE KEY-----" > identity.pem
echo $EC2_SECRET_KEY \
 | sed -e 's/- /\n/g' -e 's/ -/\n/' \
 | sed -e 's/.*-$//g' \
 | tail -n2 \
 | head -n1 \
 | sed -e 's/ /\n/g' >> identity.pem
echo "-----END RSA PRIVATE KEY-----" >> identity.pem

chmod 700 identity.pem

mkdir -p ~/.ssh
ssh-keyscan -H $IPV4_ADDR >> ~/.ssh/known_hosts

scp -r -i identity.pem $SCRIPT_DIR/../ui/frontend/build ubuntu@$IPV4_ADDR:
scp -r -i identity.pem $SCRIPT_DIR/../ui/target/release/ui ubuntu@$IPV4_ADDR:ui
scp -r -i identity.pem $SCRIPT_DIR/../compiler/fetch.sh ubuntu@$IPV4_ADDR:fetch.sh

ssh -i identity.pem ubuntu@$IPV4_ADDR "./fetch.sh"
ssh -i identity.pem ubuntu@$IPV4_ADDR "sudo systemctl start playground"

rm identity.pem