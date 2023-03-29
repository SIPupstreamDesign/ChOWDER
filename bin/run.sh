#!/bin/sh

ORIGIN=`pwd`

cd `dirname $0`/..

cd redis && ./redis-server &\
sleep 3s ; cd server && node ./server.js && fg &\

if [ -e "/usr/bin/turnserver" ]; then
	if [ -e "/usr/local/bin/turnserver" ]; then
        turnserver -c /usr/local/etc/turnserver.conf
    fi
fi

cd $ORIGIN
