## Windows環境での開発手順
* wslとubuntuインストール
    - 動作確認:Ubuntu 24.04

* ubuntuでnode.js, docker, docker-composeインストール
    - node v20.20.0
    - Docker version 28.1.1, build 4eba377
    - Docker Compose version v2.35.1

* WSLで `git clone` ChOWDER2ディレクトリ上に移動

* 開発環境用の自己証明書を作る
> sh generate_ssl_cert.sh

* docker-compose 起動
> docker compose up --build

* npm install
    * VSCodeの赤波線消すため


### TypeScriptコードの変更
* src/ 内のコードを修正すると自動でTS/Webpackビルドが走ってDocker内のフロント/サーバが更新される

### package.jsonレベルで変更があった場合
* docker-composeを落として再ビルドしてください
> docker compose up --build


### 初期管理者ユーザーの運用
* 初回起動時のみ、初期ユーザーとして以下が自動作成されます。
    - admin: ID/PW = ChOWDERAdministrator
* 初回ログイン後は、セキュリティのため初期ユーザーを削除またはパスワード変更してください。
* いったん初期化が完了すると、初期ユーザーを削除しても通常の再起動では復活しません。
* `bash clean_restart.sh` は Redis データを削除するため、次回起動時は再び初期化が走ります。


### WebRTC設定
.envにローカルIPとグローバルIPを書いて
ホストマシンのポートを解放してください
* HTTPS
    - TCP: 443
* WebRTC
    - TCP/UDP: .env および docker-compose.ymlで指定したもの


### apacheでリバースプロキシする場合の設定の一例

> sudo apt install apache2 -y
> sudo a2enmod proxy proxy_http ssl proxy_wstunnel rewrite
> sudo systemctl restart apache2

> touch /etc/apache2/sites-available/docker-ssl.conf
```conf
# docker-ssl.conf
<VirtualHost *:443>
    ServerName localhost

    SSLEngine on
    SSLCertificateFile /etc/apache2/ssl/apache.crt
    SSLCertificateKeyFile /etc/apache2/ssl/apache.key

    ProxyPreserveHost On

    # HTTPヘッダーを見てWebSocket通信を検知し、ws:// に流す
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://localhost:3080/$1 [P,L]

    # 上記に合致しない通常の通信は http:// に流す
    ProxyPass / http://localhost:3080/
    ProxyPassReverse / http://localhost:3080/

    # エラーログ設定
    ErrorLog ${APACHE_LOG_DIR}/docker-proxy-error.log
    CustomLog ${APACHE_LOG_DIR}/docker-proxy-access.log combined
</VirtualHost>
```
> sudo a2ensite docker-ssl.conf
> sudo apache2ctl configtest
> sudo systemctl restart apache2
