@echo off

for /f "usebackq tokens=15" %%a in (`ipconfig ^| find "IPv4 ƒAƒhƒŒƒX" ^| find "192.168."`) do (
	openssl req -newkey rsa:2048 -x509 -nodes -keyout ../server/key.pem -new -out ../server/cert.pem -sha256 -days 365 -subj "/C=JA/CN=%%a" -addext "subjectAltName = DNS:localhost,IP:%%a,IP:127.0.0.1"
        copy /Y ..\server\cert.pem ..\public\cert.pem
	@pause
)