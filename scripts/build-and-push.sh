#!/usr/bin/env bash

set -eo pipefail
pnpm -r build
pnpm changeset publish
git push origin main --follow-tags
