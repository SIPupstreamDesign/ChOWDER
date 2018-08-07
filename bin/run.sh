#!/bin/sh

pushd `dirname $0`/..
cd redis && ./redis-server &\
cd server && node ./server.js && fg
popd