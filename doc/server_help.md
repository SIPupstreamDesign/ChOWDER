## Windows環境での開発手順
* wslとubuntuインストール
    - 動作確認:Ubuntu 24.04

* ubuntuでnode.js, docker, docker-composeインストール
    - node v20.20.0
    - Docker version 28.1.1, build 4eba377
    - Docker Compose version v2.35.1

* WSLで `git clone` ChOWDER2ディレクトリ上に移動

* opensslで開発環境用の自己証明書を作る
    - ssl/cert.pem
    - ssl/key.pem
> openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/C=JP/ST=Tokyo/L=Chiyoda/O=Development/CN=localhost"

* docker-compose 起動
> docker compose up --build

* npm install
    * VSCodeの赤波線消すため


## その他環境での開発手順
node.js, docker, docker-composeインストール
    - node v20.20.0
    - Docker version 28.1.1, build 4eba377
    - Docker Compose version v2.35.1

* terminalで `git clone` ChOWDER2ディレクトリ上に移動

* opensslで開発環境用の自己証明書を作る
    - ssl/cert.pem
    - ssl/key.pem
> openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/C=JP/ST=Tokyo/L=Chiyoda/O=Development/CN=localhost"

* docker-compose 起動
> docker compose up --build

* npm install
    * VSCodeの赤波線消すため


### TypeScriptコードの変更
* src/ 内のコードを修正すると自動でTS/Webpackビルドが走ってDocker内のフロント/サーバが更新される

### package.jsonレベルで変更があった場合
* docker-composeを落として再ビルドしてください
> docker compose up --build


### WebRTC設定
.envにローカルIPとグローバルIPを書いて
ホストマシンのポートを解放してください
* HTTPS
    - TCP: 443
* WebRTC
    - TCP/UDP: .env および docker-compose.ymlで指定したもの


### 各種ユーザーの登録
https://localhost/manage.html  にアクセスし、必要なアカウントを登録します
ユーザーに割り当てられる権限は下記になります
* administrator
    - controller権限に加え、サーバーの切り替え、他のユーザーの管理等に使用する管理者
* controller
    - ディスプレイの許可、コンテンツの追加/削除が可能なユーザー
* display
    - ディスプレイとして接続のみ可能なユーザー
    