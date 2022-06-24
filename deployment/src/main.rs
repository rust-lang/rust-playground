use anyhow::{Error, Result};
use aws_sdk_ec2::model::*;
use futures::StreamExt;
use log::*;

use std::ffi::OsStr;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

async fn get_image(ec2_client: &aws_sdk_ec2::Client) -> Result<Image, Error> {
    // This magic number is the owner id for Amazon. Using AMIs
    // from other users could be a security risk
    const AMAZON_AMI_OWNER_ID: &str = "099720109477";

    let image_filter = Filter::builder()
        .name("name")
        .values("ubuntu/images/hvm-ssd/ubuntu-*-amd64*")
        .build();

    let images = ec2_client
        .describe_images()
        .owners(AMAZON_AMI_OWNER_ID)
        .filters(image_filter)
        .send()
        .await?;

    // Choose the image with this highest image id.
    let mut images = images
        .images()
        .ok_or(Error::msg("Failed to fetch images"))?
        .to_owned();

    images.sort_by(|a, b| {
        a.creation_date()
            .unwrap_or_default()
            .cmp(b.creation_date().unwrap_or_default())
            .reverse()
    });

    Ok(images
        .iter()
        .next()
        .ok_or(Error::msg("No images found."))?
        .to_owned())
}

const TAG_NAME: &str = "playground";
const TAG_VALUE: &str = "production";

fn get_deployment_tags() -> TagSpecification {
    TagSpecification::builder()
        .resource_type(ResourceType::Instance)
        .tags(Tag::builder().key(TAG_NAME).value(TAG_VALUE).build())
        .build()
}

async fn create_ec2_instance(
    ec2_client: &aws_sdk_ec2::Client,
    image: &Image,
) -> Result<Instance, Error> {
    const KEY_NAME: &str = "Deployment";

    let tag_specification = get_deployment_tags();

    let user_data: &str = include_str!("../assets/machine_setup.sh");
    let user_data = base64::encode(user_data);

    debug!("User Data = {}", user_data);
    info!("Launching instance...");

    let root_drive_config = BlockDeviceMapping::builder()
        .device_name("/dev/sda1")
        .ebs(EbsBlockDevice::builder().volume_size(30).build())
        .build();

    let result = ec2_client
        .run_instances()
        .image_id(
            image
                .image_id()
                .ok_or(Error::msg("Image has no id (wat?)"))?,
        )
        .instance_type(InstanceType::C52xlarge)
        .key_name(KEY_NAME)
        .block_device_mappings(root_drive_config)
        .min_count(1)
        .max_count(1)
        .tag_specifications(tag_specification)
        .user_data(user_data)
        .send()
        .await?;

    let instance = &result
        .instances()
        .ok_or(Error::msg("No instances created"))?[0];

    let instance_id = instance
        .instance_id()
        .ok_or(Error::msg("No instance id (wtf?)"))?;

    info!("Waiting on instance {} to start up...", instance_id);

    wait(
        ec2_client,
        &[instance_id.to_owned()],
        Duration::from_secs(300),
    )
    .await?;

    info!("Instance started.");

    Ok(instance.to_owned())
}

/**
 * Terminates all instances tagged for deployment except `new_instance_id`.
 */
async fn teardown_old_instances(client: &aws_sdk_ec2::Client, new_instance_id: &str) -> Result<()> {
    info!("***Teardown old instances***");
    info!("Query all tagged instances...");

    let filter = Filter::builder()
        .name(format!("tag:{}", TAG_NAME))
        .values(TAG_VALUE)
        .build();

    let instance_pages = client.describe_instances().filters(filter).into_paginator();

    let mut instances = instance_pages.items().send();
    let mut terminate_instances = vec![];

    loop {
        let reservations = match instances.next().await {
            Some(r) => r,
            None => {
                break;
            }
        }?;

        let instances = reservations
            .instances()
            .ok_or(Error::msg("No instances."))?;

        for i in instances {
            let instance_id = i.instance_id().ok_or(Error::msg("No instance id."))?;

            if instance_id == new_instance_id {
                info!("Skipping {}. Newly deployed instance.", new_instance_id);
            } else {
                info!("Scheduling {} for termination.", instance_id);

                terminate_instances.push(instance_id.to_owned());
            }
        }
    }

    if terminate_instances.len() > 0 {
        info!("Terminating instances {:#?}...", terminate_instances);

        client
            .terminate_instances()
            .set_instance_ids(Some(terminate_instances))
            .send()
            .await?;
    } else {
        info!("No instances to terminate.");
    }

    Ok(())
}

async fn wait(
    client: &aws_sdk_ec2::Client,
    instance_ids: &[String],
    timeout: Duration,
) -> Result<()> {
    let mut current_time;
    let end_time = Instant::now() + timeout;

    info!("Waiting on {:#?}", instance_ids);

    loop {
        info!("Checking instance state...");
        match client
            .describe_instance_status()
            .set_instance_ids(Some(instance_ids.to_owned()))
            .send()
            .await
        {
            Ok(v) => {
                match v
                    .instance_statuses()
                    .ok_or(Error::msg("No status for instances. Retrying."))
                {
                    Ok(v) => {
                        if v.len() != instance_ids.len() {
                            info!("Incorrect instance count returned. Retrying.");
                        } else if v.iter().all(|s| match s.instance_status() {
                            Some(s) => {
                                info!("Instance status {:#?}", s.status());
                                s.status() == Some(&SummaryStatus::Ok)
                            }
                            None => {
                                info!("No instance status. Retrying.");
                                false
                            }
                        }) {
                            info!("Instance ok!");
                            break;
                        } else {
                            info!("Instance not yet ok. Retrying.");
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        };

        info!("Will check again in 15s...");

        tokio::time::sleep(Duration::from_secs(15)).await;

        current_time = Instant::now();

        if current_time > end_time {
            return Err(Error::msg("Timeout waiting for instances."));
        }
    }

    Ok(())
}

async fn get_ip_name(ec2_client: &aws_sdk_ec2::Client, instance_id: &str) -> Result<String> {
    let response = ec2_client
        .describe_instances()
        .instance_ids(instance_id)
        .send()
        .await?;

    let ip_name = response
        .reservations()
        .ok_or(Error::msg("No reservations (wtf?)."))?[0]
        .instances()
        .ok_or(Error::msg("No instances (wtf?)."))?[0]
        .public_dns_name()
        .ok_or(Error::msg("No DNS name (wtf?)."))?;

    Ok(ip_name.to_owned())
}

fn assert_env_set(var: &str) {
    if std::env::var(var).is_err() {
        error!("{} environment variable not set.", var);
        panic!("{} environment variable not set.", var);
    }
}

/**
 * Installs the SSH private key so you can copy files to and run programs on the
 * EC2 instance.
 */
fn install_ssh_key(ip_name: &str) -> Result<PathBuf> {
    let private_key = std::env::var("EC2_SECRET_KEY").unwrap();

    info!("Dumping ssh key to file...");

    let mut file = std::fs::File::create("identity.pem")?;
    let metadata = file.metadata()?;
    let mut permissions = metadata.permissions();

    permissions.set_mode(0o600);
    file.set_permissions(permissions)?;
    file.write_all(private_key.as_bytes())?;

    let result = Command::new("ssh-keygen")
        .arg("-l")
        .arg("-f")
        .arg("identity.pem")
        .output();

    info!(format!("Key fingerprint {}", String::from_utf8_lossy(result.stdout)));

    info!("Fetching cert fingerprint...");

    let result = Command::new("ssh-keyscan")
        .args(&["-H", ip_name])
        .output()?;

    if !result.status.success() {
        error!("Failed to add known host.");
        error!("exit code {}", result.status.code().unwrap_or(1));
        error!("---stdout---\n{}", String::from_utf8_lossy(&result.stdout));
        error!("---stderr---\n{}", String::from_utf8_lossy(&result.stderr));

        return Err(Error::msg("Failed to add instance to SSH known hosts."));
    }

    info!("Dumping fingerprint to known_hosts");
    info!("Creating ~/.ssh...");

    let ssh_dir = dirs::home_dir().unwrap().join(".ssh");

    match std::fs::create_dir_all(&ssh_dir) {
        Ok(_) => {
            info!("Created.");
        }
        Err(e) => {
            warn!("Couldn't create directory; continuing: {}", e);
        }
    };

    let known_hosts_path = ssh_dir.join("known_hosts");

    let mut known_hosts = std::fs::File::options()
        .write(true)
        .append(true)
        .create(true)
        .open(&known_hosts_path)?;

    known_hosts.write_all(&result.stdout)?;

    info!("Updated known_hosts.");

    Ok(PathBuf::from("./identity.pem").canonicalize()?)
}

fn copy_artifacts<P1, P2, P3>(host: &str, key_file: P1, src: P2, dst: P3) -> Result<()>
where
    P1: AsRef<Path>,
    P2: AsRef<Path>,
    P3: AsRef<Path>,
{
    info!(
        "Copying {} to ubuntu@{}:{}",
        src.as_ref().to_string_lossy(),
        host,
        dst.as_ref().to_string_lossy()
    );

    let result = Command::new("scp")
        .args(&[
            OsStr::new("-r"),
            OsStr::new("-i"),
            key_file.as_ref().as_os_str(),
            src.as_ref().as_os_str(),
            OsStr::new(&format!(
                "ubuntu@{}:{}",
                host,
                dst.as_ref()
                    .to_str()
                    .ok_or(Error::msg("dst path is not a UTF-8 string."))?
            )),
        ])
        .output()?;

    if !result.status.success() {
        error!("Failed to run scp.");
        error!("exit code {}", result.status.code().unwrap_or(1));
        error!("---stdout---\n{}", String::from_utf8_lossy(&result.stdout));
        error!("---stderr---\n{}", String::from_utf8_lossy(&result.stderr));

        return Err(Error::msg("Failed to add instance to SSH known hosts."));
    }

    Ok(())
}

fn run_ssh_command<P1: AsRef<Path>>(host: &str, key_file: P1, args: &[&str]) -> Result<()> {
    info!("Running `ssh {}", args.join(" "));

    let result = Command::new("ssh")
        .arg("-i")
        .arg(key_file.as_ref())
        .arg(format!("ubuntu@{}", host))
        .args(args)
        .status()?;

    if !result.success() {
        error!("Failed to run ssh.");
        return Err(Error::msg("Failed run SSH command."));
    }

    Ok(())
}

async fn associate_public_ip(
    ec2_client: &aws_sdk_ec2::Client,
    instance_id: &str,
    ip_addr: &str,
) -> Result<()> {
    info!("Associating elastic IP address with instance...");
    ec2_client
        .associate_address()
        .instance_id(instance_id)
        .allow_reassociation(true)
        .public_ip(ip_addr)
        .send()
        .await?;

    info!("Public IP {} now associated with {}.", ip_addr, instance_id);

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // You must set the access key ID associated with the IAM
    // user that will run the deployment.
    assert_env_set("AWS_ACCESS_KEY_ID");

    // You must set the secret access key corresponding to
    // AWS_ACCESSS_KEY_ID. This is the IAM user's secret.
    assert_env_set("AWS_SECRET_ACCESS_KEY");

    assert_env_set("EC2_SECRET_KEY");

    assert_env_set("ELASTIC_IP_ADDRESS");

    assert_env_set("DOCKER_REPOSITORY");

    env_logger::init();

    let public_ip_addr = std::env::var("ELASTIC_IP_ADDRESS").unwrap();
    let docker_repository = std::env::var("DOCKER_REPOSITORY").unwrap();

    let sdk_config = aws_config::from_env().region("us-west-2").load().await;

    let ec2_client = aws_sdk_ec2::Client::new(&sdk_config);

    let image = get_image(&ec2_client).await?;
    info!("Using image {:#?}", image);

    let instance = create_ec2_instance(&ec2_client, &image).await?;
    let instance_id = instance.instance_id().unwrap();

    let ip_name = get_ip_name(&ec2_client, &instance_id).await?;

    info!("Instance DNS name {}", ip_name);

    let key_file = install_ssh_key(&ip_name)?;

    let artifacts_base_dir = PathBuf::from("./").canonicalize()?;

    info!(
        "Artifacts base directory = {}",
        artifacts_base_dir.to_string_lossy()
    );

    copy_artifacts(
        &ip_name,
        &key_file,
        artifacts_base_dir.join("./ui/frontend/build"),
        "",
    )?;
    copy_artifacts(
        &ip_name,
        &key_file,
        artifacts_base_dir.join("./target/release/ui"),
        "ui",
    )?;
    copy_artifacts(&ip_name, &key_file, artifacts_base_dir.join("compiler/fetch.sh"), "fetch.sh")?;

    run_ssh_command(
        &ip_name,
        &key_file,
        &["./fetch.sh", &docker_repository],
    )?;

    run_ssh_command(
        &ip_name,
        &key_file,
        &["sudo", "systemctl", "start", "playground"],
    )?;

    std::fs::remove_file(&key_file)?;

    // Swap over elastic IP address
    associate_public_ip(&ec2_client, &instance_id, &public_ip_addr).await?;

    match teardown_old_instances(&ec2_client, &instance_id).await {
        Ok(_) => {
            info!("Teardown successful.");
        }
        Err(e) => {
            warn!(
                "Teardown failed: {}. You may need to manually clean up some instances.",
                e
            )
        }
    };

    Ok(())
}
