#!/bin/sh

ORIGIN=`pwd`
cd `dirname $0`

privateip=127.0.0.1

while true;do
    echo "Install a cert key for SSL? (yes or no)"
    read answer
    case $answer in
        yes|y)
			echo "Please input the private IP address(e.g. 192.168.xxx.xxx)"
			read privateip
			echo "Private IP : $privateip"
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

if [ ! -e "../redis/redis-server" ]; then
	if [ ! -e "/usr/bin/redis-server" ]; then
		curl -O http://download.redis.io/redis-stable.tar.gz
		tar xf redis-stable.tar.gz
		cd redis-stable
		make
		cp src/redis-server ../../redis/
		cd ..
		rm -rf redis-*
	fi
fi

if [ ! -e "/usr/bin/turnserver" ]; then
	curl -O http://turnserver.open-sys.org/downloads/v4.5.1.1/turnserver-4.5.1.1.tar.gz
	tar xf turnserver-4.5.1.1.tar.gz
	cd turnserver-4.5.1.1
	./configure
	make && make install
	cd ..
	rm -rf turnserver-4.5.1.1
fi

if [ -e "/usr/local/etc/turnserver.conf" ]; then
	sed -e "s/listening-ip=0.0.0.0/listening-ip=$privateip/" turnserver.conf > /usr/local/etc/turnserver.conf
else
	echo "Error: Not fond turnserver.conf in your system"
fi

if [ -e "/usr/local/etc" ]; then
	cp ../server/cert.pem /usr/local/etc/cert.pem
	cp ../server/key.pem /usr/local/etc/key.perm
else 
	echo "Error: Not fond /usr/local/etc/"
fi

npm install --unsafe-perm

cd $ORIGIN