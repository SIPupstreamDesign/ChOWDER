@echo off

openssl req -newkey rsa:2048 -x509 -nodes -keyout ../server/key.pem -new -out ../server/cert.pem -sha256 -days 365 -subj "/C=JA/CN=%1" -addext "subjectAltName = DNS:localhost,IP:%1,IP:127.0.0.1"
copy /Y ..\server\cert.pem ..\public\cert.pem
@pause