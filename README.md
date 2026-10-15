# Fare Map
[https://fare.cnion.dev/](https://fare.cnion.dev/)

駅の運賃表のように、各駅への運賃を地図上に表示するWebアプリケーション。(beta)

## 機能
現時点ではJR東日本の首都圏の駅を対象に、選択された駅からのIC・切符運賃を表示する機能を実装しています。

＊IC運賃は私鉄区間などの要件も考慮済みです。近日中に私鉄の運賃マップも実装する予定です。

## データについて
データセットは、[CoreNion/fare-data](https://github.com/CoreNion/fare-data)で管理しています。

＊Fare Mapアプリは非営利/趣味の個人開発プロジェクトであり、情報の正確性や適切性については保証できません。このデータを活用する場合は自己責任でご利用ください。

### データ元のライセンス・出典
＊Fare Map自体のソースコードのライセンスは[LICENSE](./LICENSE)を参照

- [鉄道駅LOD](https://uedayou.net/jrslod/) CC BY-SA 4.0
  - 駅や路線の座標情報を使用
- [ＭＡＲＳ for MS-DOS](https://www.swa785.net/pub/mars/index.html)
  - 主にJR線の営業キロデータを使用
  - 「【転載可否】　可」の記載に基づき転載していますが、問題がある場合はご連絡ください。
- [都営地下鉄 運賃（キロ程表） - 東京都オープンデータカタログ](catalog.data.metro.tokyo.lg.jp/dataset/t000018d0000000025) CC BY-SA 4.0
  - 都営地下鉄の運賃と営業キロ情報を使用
- 他の各社の運賃情報については旅客営業規程やICカード乗車券取扱規則などの約款を参照しています。