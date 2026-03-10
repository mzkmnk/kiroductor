# Phase 3: ACP メソッド（agent→client）+ テスト

kiro-cli エージェントから Electron アプリ（クライアント）へ送られてくるリクエストを処理するメソッドを実装する。
各メソッドは ACP プロトコルで定義されたインターフェースを実装する。

## 関連ドキュメント

- [ACP プロトコル仕様](../research/acp-protocol.md) — メソッド名・型・シーケンスの詳細
- [実装計画](../design/implementation-plan.md) — アーキテクチャ全体の設計判断
- 前フェーズ: [Phase 2 — Repository 層](./phase2.md)
- 次フェーズ: [Phase 4 — Service 層](./phase4.md)

## readTextFile — エージェントが指定したファイルを読み込んで返す

- [ ] リクエスト・レスポンスの型（`ReadTextFileRequest` / `ReadTextFileResponse`）を定義する
- [ ] `ReadTextFileMethod` クラスを作成し、ファイルシステム（`fs`）を依存注入で受け取るようにする
- [ ] 指定されたパスのファイルを UTF-8 で読み込む処理を実装する
- [ ] 読み込んだ内容を `{ content }` の形で返すよう実装する
- [ ] テスト: 存在するファイルを指定すると内容が返ること
- [ ] テスト: 存在しないファイルを指定するとエラーが投げられること
- [ ] 備考: `params.limit`（最大行数）/ `params.line`（開始行）は MVP では無視する（[`implementation-plan.md`](../design/implementation-plan.md) 参照、将来対応は [Phase 8](./phase8.md)）

## writeTextFile — エージェントが指定した内容をファイルへ書き込む

- [ ] リクエスト・レスポンスの型（`WriteTextFileRequest` / `WriteTextFileResponse`）を定義する
- [ ] `WriteTextFileMethod` クラスを作成し、ファイルシステム（`fs`）を依存注入で受け取るようにする
- [ ] 指定されたパスへ内容を UTF-8 で書き込む処理を実装する
- [ ] 書き込み成功時に空オブジェクト `{}` を返すよう実装する
- [ ] テスト: ファイルが正しく書き込まれること
- [ ] テスト: 書き込みに失敗した場合エラーが投げられること

## requestPermission — エージェントが操作の許可を求めてきたときに応答する

- [ ] リクエスト・レスポンスの型（`RequestPermissionRequest` / `RequestPermissionResponse`）を定義する
- [ ] `RequestPermissionMethod` クラスを作成し、通知サービスを依存注入で受け取るようにする
- [ ] MVP として最初の選択肢を自動承認する処理を実装する（`optionId` を返す）
- [ ] 承認内容をレンダラー（画面）へ通知する処理を実装する
- [ ] テスト: 最初のオプション ID が返されること
- [ ] テスト: レンダラーへの通知が実行されること

## sessionUpdate — エージェントの進捗や発言をリアルタイムで画面に反映する

- [ ] `SessionUpdateMethod` クラスを作成し、メッセージ Repository と通知サービスを依存注入で受け取るようにする
- [ ] `agent_message_chunk` イベント: エージェント返答のテキストを追記し、画面へ通知する処理を実装する
- [ ] `tool_call` イベント: ツール呼び出しの開始を記録し、画面へ通知する処理を実装する
- [ ] `tool_call_update` イベント: ツール呼び出しの結果を更新し、画面へ通知する処理を実装する
- [ ] 上記以外のイベント: 画面へ転送するだけのフォールスルー処理を実装する
- [ ] テスト: 各イベントで Repository と通知サービスが期待通りに呼ばれること
- [ ] テスト: 未知イベントでは画面通知のみ呼ばれること

## client-handler — 上記メソッドをひとつのクラスにまとめてルーティングする

- [ ] `KiroductorClientHandler implements Client` のクラスを作成する
- [ ] 各メソッドインスタンスをコンストラクタで受け取るよう実装する
- [ ] 受け取ったリクエストを対応するメソッドへ委譲するだけの実装をする
