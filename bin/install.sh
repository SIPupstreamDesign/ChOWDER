#!/bin/sh

OSNAME=`uname`
if [ ${OSNAME} = "Linux" ]; then
	wget http://download.redis.io/redis-stable.tar.gz
	tar xvzf redis-stable.tar.gz
	cd `dirname $0`/redis-stable
	make
	cp src/redis-server ../../redis/
fi

cd `dirname $0`/../
npm install

