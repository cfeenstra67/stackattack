#!/usr/bin/env bash

set -eo pipefail

ENV_STACK=${ENV_STACK:-env}

ACCOUNT_ID=$(aws sts get-caller-identity | jq -r .Account)
REGION=$(pulumi -s $ENV_STACK config get aws:region)

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

REPO_URL=$(pulumi -s $ENV_STACK stack output repoUrl --show-secrets)

TAG=$(git rev-parse --short=8 HEAD)

docker buildx build --platform=linux/amd64,linux/arm64 -t $REPO_URL:$TAG -f Dockerfile ../.. --push
