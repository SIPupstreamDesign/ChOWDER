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

curl -O http://turnserver.open-sys.org/downloads/v4.5.1.1/turnserver-4.5.1.1.tar.gz
tar xf turnserver-4.5.1.1.tar.gz
cd turnserver-4.5.1.1
./configure
make && make install
cd ..
rm -rf turnserver-4.5.1.1
cp turnserver.conf /usr/local/etc/turnserver.conf
cp ../server/server.crt /usr/local/etc/server.crt
cp ../server/server.key /usr/local/etc/server.key

npm install --unsafe-perm

cd $ORIGIN