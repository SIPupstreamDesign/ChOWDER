#!/bin/sh

ORIGIN=`pwd`
cd `dirname $0`

privateip=127.0.0.1

echo "Please input the private IP address for this host. (e.g. 192.168.xxx.xxx)"
read privateip

if ! [[ $privateip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    echo "Error: Invalid IP address format."
    exit 1
fi

echo "Private IP : $privateip"

# mediasoupSettings.json
mediasoup_json="../server/mediasoupSettings.json"
awk -v ipaddress="$privateip" '{gsub(/"announcedIp"[[:space:]]*:[[:space:]]*"[^"]+"/, "\"announcedIp\": \"" ipaddress "\"")}1' "$mediasoup_json" > tmp.json
mv tmp.json "$mediasoup_json"

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
if [ "$(uname)" != "Darwin" ]; then
    if [ ! -e "../redis/redis-server" ]; then
        curl -O http://download.redis.io/redis-stable.tar.gz
        tar xf redis-stable.tar.gz
        cd redis-stable
        make distclean
        make
        cp src/redis-server ../../redis/
        cd ..
        rm -rf redis-*
    fi
else
    # mac
    cp ../redis/redis-server.mac ../redis/redis-server
    chmod a+x ../redis/redis-server
fi

# npm install --force
npm install --arch=x64

cd $ORIGIN