#!/bin/bash

set -x # Shows each command

# Variables
PROJ_NAME=db_api
## Location variables
REPOSITORY=https://version.lab.fi/iot/db_api_v2.git
PROJ_DIR=~/projects/${PROJ_NAME}
DEPLOY_DIR=/opt/${PROJ_NAME}
SOURCE_ENV_FILE=~/${PROJ_NAME}.service.env
## Service ownership variables
PROJ_USER="${PROJ_NAME}_user"
PROJ_GROUP="${PROJ_NAME}_group"
## Service variables
SERVICE_NAME="${PROJ_NAME}-service"
DESCRIPTION="Backend system for data delivery in IoT Pipeline"
EXEC_START="$(which node) $DEPLOY_DIR/src/server.mjs"
WORKING_DIR="${DEPLOY_DIR}"
ENV_FILE="${DEPLOY_DIR}/.env"
SYSLOG_IDENTIFIER="${SERVICE_NAME}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

mkdir -p ${PROJ_DIR}
# git clone ${REPOSITORY} ${PROJ_DIR}
cd ${PROJ_DIR}
sudo mkdir -p $DEPLOY_DIR
cp $SOURCE_ENV_FILE $PROJ_DIR/.env
sudo cp -r $PROJ_DIR/. $DEPLOY_DIR

# Handle ownerships
sudo groupadd $PROJ_GROUP
sudo useradd -m -r -s /usr/sbin/nologin -g $PROJ_GROUP $PROJ_USER
# sudo userdel $PROJ_USER
# sudo rm -rf /home/$PROJ_USER
sudo chown -R $PROJ_USER:$PROJ_GROUP $DEPLOY_DIR

# Switch to the service user - manual processing
# sudo -u $PROJ_USER /bin/bash
# rm -rf node_modules/ package-lock.json

# Install NodeJS dependencies as the service user
sudo -u $PROJ_USER bash -c "cd $DEPLOY_DIR && npm i"

# Create the service file
cat <<EOL | sudo tee $SERVICE_FILE
[Unit]
Description=${DESCRIPTION}
After=network.target

[Service]
ExecStart=${EXEC_START}
WorkingDirectory=${WORKING_DIR}
Restart=always
RestartSec=10
User=${PROJ_USER}
Group=${PROJ_GROUP}
EnvironmentFile=${ENV_FILE}
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${SYSLOG_IDENTIFIER}

[Install]
WantedBy=multi-user.target
EOL

# Systemd commands
sudo systemctl daemon-reload
sudo systemctl stop ${SERVICE_NAME}
sudo systemctl start ${SERVICE_NAME}
sudo systemctl status ${SERVICE_NAME}
# sudo systemctl restart ${SERVICE_NAME}
sudo systemctl enable ${SERVICE_NAME}

cd ~
set +x # disable showing commands