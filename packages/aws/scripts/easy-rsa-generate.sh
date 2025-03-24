#!/usr/bin/env bash

set -e

COMMON_NAME=${COMMON_NAME:-"Easy-RSA CA"}

SERVER_NAME=${SERVER_NAME:-server}

CLIENT_NAME=${CLIENT_NAME:-client}

TMPDIR=$(mktemp -d)

trap "rm -rf $TMPDIR" EXIT

cd $TMPDIR

curl --fail -s -L https://api.github.com/repos/OpenVPN/easy-rsa/tarball/v3.2.2 -o repo.tar.gz

tar -xzf repo.tar.gz

cd OpenVPN-*/easyrsa3

easyrsa-build() {
    ./easyrsa init-pki
    echo | ./easyrsa --req-cn="$COMMON_NAME" --nopass build-ca
    echo yes | ./easyrsa --san=DNS:$SERVER_NAME --nopass build-server-full $SERVER_NAME
    echo yes | ./easyrsa --nopass build-client-full $CLIENT_NAME
}

easyrsa-build &> /dev/null

export ca="$(cat pki/ca.crt)"

export serverCrt="$(cat pki/issued/$SERVER_NAME.crt)"

export serverPrivateKey="$(cat pki/private/$SERVER_NAME.key)"

export clientCrt="$(cat pki/issued/$CLIENT_NAME.crt)"

export clientPrivateKey="$(cat pki/private/$CLIENT_NAME.key)"

VARS=(ca serverCrt serverPrivateKey clientCrt clientPrivateKey)

jq -n '$ARGS.positional | map({ (.): env[.] }) | add' --args "${VARS[@]}"
