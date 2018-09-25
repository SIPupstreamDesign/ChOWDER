#!/bin/sh

ORIGIN=`pwd`
cd `dirname $0`

curl -O http://download.redis.io/redis-stable.tar.gz
tar xf redis-stable.tar.gz
cd redis-stable
make
cp src/redis-server ../../redis/
cd ..
rm -rf redis-*

cd ..
npm install

cd tileimage
npm install

cd $ORIGIN