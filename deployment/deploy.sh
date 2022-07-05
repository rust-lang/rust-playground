#! /bin/bash

if [-z $DOCKER_USER]
then
    echo "DOCKER_USER not set. This is the user prefix for the playground container name (e.g. docker_user/playground:12345)."
    exit 1
fi

if [-z $DEPLOYMENT_ID]
then
    echo "DEPLOYMENT_ID not set. This is the tag for the playground image to use."
    exit 1
fi

if [-z $ENVIRONMENT_ID]
then
    echo "Elastic Beanstalk application environment ENVIRONMENT_ID not set. This is where the playground gets deployed."
    exit 1
fi

if [-z $S3_BUCKET]
then
    echo "S3_BUCKET not set. This is where EB application configurations get uploaded."
    exit 1
fi

image_name="$DOCKER_REGISTRY/playground:$DEPLOYMENT_ID"
config_file=$DEPLOYMENT_ID.Dockerrun.aws.json

cat Dockerrun.aws.json.template | sed "s/\$image_name/$image_name/" > $config_file

aws s3 mv $config_file $S3_BUCKET/$config_file

# aws elasticbeanstalk