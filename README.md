## Windows環境での開発手順
* wslとubuntuインストール
    - 動作確認:Ubuntu 24.04

* ubuntuでnode.js, docker, docker-composeインストール
    - node v20.20.0
    - Docker version 28.1.1, build 4eba377
    - Docker Compose version v2.35.1

* WSLでリポジトリを `git clone`

### clone後の初期ビルドと起動

依存インストールとビルドはDockerコンテナ内で行います。初期ビルドを先に完了させ、開発用watchとの同時ビルドを避けます。

1. cloneしたディレクトリへ移動し、開発環境用の自己署名証明書を生成します。

```sh
cd ChOWDER2
bash generate_ssl_cert.sh
```

証明書はDockerイメージへコピーされるため、イメージ作成より先に生成します。WebRTCを他の端末から使用する場合は、下記の「WebRTC設定」に従って、起動前に`.env`のIP設定とポート開放も行います。

2. Dockerイメージを作成します。

```sh
docker compose build app
```

ChOWDER本体の`npm install`はDockerfile内で実行されます。

3. 初期ビルドを実行します。

```sh
docker compose run --rm --no-deps app npm run build
```

Webpackのビルド成功とサーバーのTypeScriptビルド成功を確認します。

4. 開発環境を起動し、ログを確認します。

```sh
docker compose up -d
docker compose logs --tail=100 app
```

サーバー起動とWebpackのビルド成功を確認し、[HTTPS画面](https://localhost:3443/)へアクセスします。自己署名証明書の警告が表示されますが、画面が表示されれば初期起動の確認は完了です。

ホスト側の`npm install`は実行には不要です。VS Codeの型解決と赤波線の解消が必要な場合のみ、リポジトリのルートで実行します。


### TypeScriptコードの変更
* src/ 内のコードを修正すると自動でTS/Webpackビルドが走ってDocker内のフロント/サーバが更新される

### iTownsライブラリのビルド
* iTownsは2.44.2、内部のThree.jsは0.165.0をvendor/itownsのlockfileで固定しています。
* ミラーの描画専用APIはビルド時に生成します。圧縮済みライブラリを直接編集しないでください。
* ライブラリのビルド設定を変更した場合は、次のコマンドで再生成し、Controller/Displayの地図表示を確認します。

```sh
docker compose exec app npm run build:client
```

* カメラ通信方式を変更したため、更新時は開いているController/Display/iTownsアプリを一度再読み込みします。更新後の一時的な描画差は追加操作なしで収束する仕様です。

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


### Display・iTowns診断ログの取得

ログ収集は本番環境では原則行わず、検証環境でのみ明示的に有効化してください。既定値は無効です。現状は対象Display／コンテンツを選べず、有効化中の環境に接続した全対象クライアントが記録対象になります。

1. 診断を有効にしてappコンテナを起動または再作成します。

```sh
CLIENT_DIAGNOSTIC_ENABLED=true docker compose up --force-recreate app
```

診断sessionはサーバー起動時に作成され、自動では期限切れになりません。修正中にサーバーの起動・停止を繰り返す場合も、診断フラグを有効にして再起動すれば採取を再開します。再起動ごとにsession IDは新しくなるため、複数sessionのログは`diagnosticSessionId`で区別してください。このコマンドだけで有効化し、設定を`.env`などへ常時保存しないでください。

2. DisplayとControllerを接続し、対象のコンテンツを表示して、問題が発生する操作を再現します。

3. ホスト側の`logs/client-diagnostics/`にある`client-diagnostic-<UTC日付>-<diagnosticSessionId>-<連番>.jsonl`を回収します。Docker appの起動ごとに異なるsession IDのファイル群になります。同一session内では10 MiBまたはUTC日付変更時に連番で分割します。1行が1イベントのJSON Lines形式です。DisplayのWindowMetaData・revision・期待rect・DOM実測値に加え、scroll位置、祖先要素のrect/transform、offsetParentの情報、およびiTownsのカメラ世代ごとの描画後状態が記録されます。


ログファイルの保持期間はsessionの有効期間とは別で、10 MiBまたはUTC日付変更でローテーションされ、7日を超えたファイルは削除されます。各レコードは16 KiBが上限です。自動一致判定はないため、診断中に記録された同一session・`diagnosticId`のイベントを照合してください。全コンテナも停止する場合は、その後`docker compose down`を実行してください。
