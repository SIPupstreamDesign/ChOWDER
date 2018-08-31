#!/bin/sh

ORIGIN=`pwd`
cd `dirname $0`/..
cd redis && ./redis-server &\
cd server && node ./server.js && fg
cd $ORIGIN