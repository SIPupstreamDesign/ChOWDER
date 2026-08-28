#!/bin/sh

echo "subjectAltName=DNS:localhost,IP:$1,IP:127.0.0.1" > subjectnames.ext
openssl req -newkey rsa:2048 -nodes -keyout ../server/key.pem -new -out ../server/cert.crs -subj "/C=JA/CN=$1"
openssl x509 -days 365 -req -signkey ../server/key.pem < ../server/cert.crs > ../server/cert.pem -extfile subjectnames.ext
cp -f ../server/cert.pem ../public/cert.pem
rm -f subjectnames.ext
rm -f ../server/cert.crs