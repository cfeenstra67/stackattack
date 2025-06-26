#!/bin/sh
set -e

CMD=$1

shift

case $CMD in
    init)
        ./node_modules/.bin/drizzle-kit migrate --config drizzle.config.ts
        ;;
    api)
        node ./dist/main.js
    sh)
        sh
        ;;
	*)
		echo "Invalid command: $CMD"
		exit 1
		;;
esac
