#!/bin/sh

ORIGIN=`pwd`
cd `dirname $0`

OSNAME=`uname`
if [ ${OSNAME} = "Linux" ]; then
	wget http://download.redis.io/redis-stable.tar.gz
	tar xf redis-stable.tar.gz
	cd redis-stable
	make
	cp src/redis-server ../../redis/
	cd ..
	rm -rf redis-*
fi

cd ..
npm install

cd tileimage
npm install

cd $ORIGIN