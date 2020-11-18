#!/bin/sh

ORIGIN=`pwd`
cd `dirname $0`

privateip=127.0.0.1

echo "Please input the private IP address for this host. (e.g. 192.168.xxx.xxx)"
read privateip
echo "Private IP : $privateip"

# ssl
while true;do
    echo "Do you install a cert key for SSL? (yes or no)"
    read answer
    case $answer in
        yes|y)
			echo "creating cert.."
			sh create_local_cert.sh $privateip
            break
            ;;
        no|n)
            break
            ;;
        *)
            echo -e "cannot understand $answer.\n"
            ;;
    esac
done

# redis
if [ ! -e "../redis/redis-server" ]; then
	if [ ! -e "/usr/bin/redis-server" ]; then
		curl -O http://download.redis.io/redis-stable.tar.gz
		tar xf redis-stable.tar.gz
		cd redis-stable
		make distclean
		make
		cp src/redis-server ../../redis/
		cd ..
		rm -rf redis-*
	fi
fi

npm install

cd $ORIGIN