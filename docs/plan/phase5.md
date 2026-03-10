# Phase 5: Handler 層 + IPC 配線

レンダラー（画面）からの操作要求を受け取り、対応する Service へつなぐ IPC ハンドラーを実装する。
あわせて、メインプロセスの起動エントリーポイントと preload スクリプトを整備する。

## 関連ドキュメント

- [実装計画](../design/implementation-plan.md) — IPC チャンネル一覧と Handler 層の設計
- 前フェーズ: [Phase 4 — Service 層](./phase4.md)
- 次フェーズ: [Phase 6 — チャット UI](./phase6.md)

## acp.handler — ACP 接続の開始・終了・状態確認を IPC 経由で受け付ける

- [ ] `acp:start` チャンネル: レンダラーから呼ばれたら `acpConnectionService.start()` を実行するハンドラーを実装する
- [ ] `acp:stop` チャンネル: レンダラーから呼ばれたら `acpConnectionService.stop()` を実行するハンドラーを実装する
- [ ] `acp:status` チャンネル: 現在の接続状態を `connectionRepository.getStatus()` から取得して返すハンドラーを実装する

## session.handler — セッション操作を IPC 経由で受け付ける

- [ ] `session:new` チャンネル: 作業ディレクトリ（`cwd`）を受け取り `sessionService.create(cwd)` を呼ぶハンドラーを実装する
- [ ] `session:prompt` チャンネル: ユーザーテキストを受け取り `promptService.send(text)` を呼ぶハンドラーを実装する
- [ ] `session:cancel` チャンネル: `sessionService.cancel()` を呼ぶハンドラーを実装する
- [ ] `session:messages` チャンネル: `messageRepository.getAll()` の結果を返すハンドラーを実装する

## handlers/index.ts — 全ハンドラーをまとめて登録する

- [ ] `acp.handler` と `session.handler` をひとつの関数でまとめて `ipcMain.handle` に登録できるようにする

## main.ts — アプリ起動時の依存関係を組み立てる（Composition Root）

- [ ] Repository・Service・Handler の全インスタンスをここで生成する
- [ ] 依存関係を注入しながらインスタンスを組み立てる
- [ ] ハンドラーを登録する

## preload.ts — レンダラーに安全な API を公開する

- [ ] `contextBridge.exposeInMainWorld` で `window.kiroductor` として API を公開する
- [ ] `onUpdate` / `onStatusChange` を購読する関数を実装し、クリーンアップ関数を返すようにする
- [ ] `ipcRenderer` をそのまま公開しない（セキュリティのため）

## エンドツーエンド動作確認

- [ ] アプリを起動し、レンダラーからセッションを作成して "hello" を送信する
- [ ] エージェントの返答がストリーミングで画面に表示されることを確認する
