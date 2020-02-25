iOS用SSL自己署名設定方法
========================================================================================

自己署名証明書の作成
---------------------------------------------------

iOSで、ローカルネットワーク上で使用するための自己証明書を作成、登録する方法について記載します。

Windowsの場合
--------------------
コマンドプロンプトで、/binディレクトリに移動し、
以下のコマンドを実行し、自己署名証明書を作成します。

```
./create_local_cert.bat ChOWDERServerのIPアドレス
```

Linuxの場合
--------------------
```
sh create_local_cert.sh ChOWDERServerのIPアドレス
```

正常終了メッセージ例
```
$ sh create_local_cert.sh 192.168.1.8
Generating a 2048 bit RSA private key
...................+++
..+++
writing new private key to '../server/key.pem'
-----
Signature ok
subject=C = JA, CN = 192.168.1.8
Getting Private key
```

作成された証明書は、public/cert.pem及びserver/cert.pem、server/key.pemに格納されます。
以下のiOS側の設定を行い、完了後にpublic/cert.pemは削除してください。


iOS側の設定
---------------------------------------------------

ChOWDER Serverにより公開されているプロファイルをダウンロードします。
iOSのSafariで「http://[ipアドレス]:8080/cert.pem」を開き、
許可します。


<img src="image/ssl/1.png" alt="download_cert" width="585"/>

「設定」→「一般」の「ダウンロード済プロファイル」をタップし、ダウンロード済プロファイルをインストールします。

<img src="image/ssl/2.png" alt="" height="585"/>

<img src="image/ssl/3.png" alt="" height="585"/>

<img src="image/ssl/4.png" alt="" height="585"/>

<img src="image/ssl/5.png" alt="" height="585"/>

インストールが終わったら、「設定」→「一般」最下部に、「証明書信頼設定」という項目があるので、
タップして、先ほどインストールしたプロファイルを信頼するようチェックします。


<img src="image/ssl/6.png" alt="" height="585"/>

<img src="image/ssl/7.png" alt="" height="585"/>

以上で設定完了となります。

```
https://設定したIPアドレス
```

にSafariでアクセスすると、無事成功していた場合、
URLの部分が信頼されている表示となっています。
