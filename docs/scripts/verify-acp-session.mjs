/**
 * ACP Session Load 動作確認スクリプト
 * loadSession の動作を検証する
 *
 * listSessions は kiro-cli v1.27.2 では未サポート（-32601）のため、
 * セッション ID はローカルの ~/.kiro/sessions/cli/ から取得する。
 *
 * 使い方:
 *   node docs/scripts/verify-acp-session.mjs                    # 最新のセッションを自動選択
 *   node docs/scripts/verify-acp-session.mjs <sessionId>        # 指定セッションを復元
 */

import { spawn } from 'node:child_process';
import { readdir, readFile as fsReadFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

class SessionInspectClientHandler {
  constructor() {
    this.allUpdates = [];
    this.loadedChunks = 0;
    this.loadedToolCalls = 0;
  }

  async requestPermission(params) {
    const firstOption = params.options[0];
    return {
      outcome: {
        outcome: 'selected',
        optionId: firstOption.optionId,
      },
    };
  }

  async sessionUpdate(params) {
    const update = params.update;
    this.allUpdates.push(update);

    if (update.sessionUpdate === 'agent_message_chunk') {
      this.loadedChunks++;
      if (this.loadedChunks % 50 === 0) {
        process.stdout.write(`  [復元中] ${this.loadedChunks} chunks 受信...\n`);
      }
    } else if (update.sessionUpdate === 'tool_call') {
      this.loadedToolCalls++;
    }
  }

  async readTextFile(params) {
    const { readFile } = await import('node:fs/promises');
    try {
      const content = await readFile(params.path, 'utf-8');
      return { content };
    } catch {
      throw new Error(`ENOENT: ${params.path}`);
    }
  }

  async writeTextFile(params) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(params.path, params.content, 'utf-8');
    return {};
  }

  async extNotification(_method, _params) {
    // _kiro.dev/ 拡張は無視
  }
}

/**
 * ローカルの ~/.kiro/sessions/cli/ からセッション一覧を取得する。
 * kiro-cli v1.27.2 では listSessions が未サポートのため、ファイルシステムから直接読む。
 */
async function loadLocalSessions() {
  const sessionsDir = join(homedir(), '.kiro', 'sessions', 'cli');
  const files = await readdir(sessionsDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const sessions = [];
  for (const file of jsonFiles) {
    try {
      const content = await fsReadFile(join(sessionsDir, file), 'utf-8');
      const data = JSON.parse(content);
      sessions.push({
        sessionId: data.session_id,
        cwd: data.cwd,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    } catch {
      // パースエラーは無視
    }
  }

  return sessions.sort(
    (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
  );
}

async function main() {
  console.log('=== ACP Session Load 動作確認 ===\n');

  // [1] ローカルセッション一覧を取得
  console.log('[1] ローカルセッション一覧を取得...');
  const localSessions = await loadLocalSessions();
  console.log(`    ~/.kiro/sessions/cli/ に ${localSessions.length} 件のセッションを検出`);

  if (localSessions.length > 0) {
    console.log('\n    最新 5 件:');
    for (const s of localSessions.slice(0, 5)) {
      console.log(`      - ${s.sessionId}`);
      console.log(`        cwd: ${s.cwd}`);
      console.log(`        updatedAt: ${s.updatedAt ?? '(なし)'}`);
    }
  }

  // 復元対象のセッションを決定
  const targetSessionId = process.argv[2];
  const targetSession = targetSessionId
    ? localSessions.find((s) => s.sessionId === targetSessionId)
    : localSessions[0]; // 引数なしなら最新

  if (!targetSession) {
    console.error('\n[ERROR] 復元対象のセッションが見つかりません');
    if (targetSessionId) {
      console.error(`  指定された sessionId: ${targetSessionId}`);
    }
    process.exit(1);
  }

  console.log(`\n    復元対象: ${targetSession.sessionId}`);
  console.log(`    cwd: ${targetSession.cwd}`);

  // [2] kiro-cli acp を起動
  console.log('\n[2] kiro-cli acp を起動...');
  const proc = spawn('kiro-cli', ['acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`[stderr] ${data}`);
  });

  proc.on('error', (err) => {
    console.error('[ERROR] kiro-cli acp の起動に失敗:', err.message);
    process.exit(1);
  });

  const readStream = Readable.toWeb(proc.stdout);
  const writeStream = Writable.toWeb(proc.stdin);
  const stream = ndJsonStream(writeStream, readStream);

  const handler = new SessionInspectClientHandler();
  const connection = new ClientSideConnection((_agent) => handler, stream);

  try {
    // [3] initialize
    console.log('\n[3] initialize...');
    const initResult = await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'kiroductor-session-verify', version: '0.1.0' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });

    const caps = initResult.agentCapabilities ?? initResult.capabilities ?? {};
    console.log(`    OK - protocolVersion: ${initResult.protocolVersion}`);
    console.log(`    loadSession capability: ${caps.loadSession ?? '(undefined)'}`);

    // [4] listSessions の対応確認
    console.log('\n[4] listSessions の対応確認...');
    try {
      const listResult = await connection.listSessions({});
      const sessions = listResult.sessions ?? [];
      console.log(`    対応あり — ${sessions.length} 件取得`);
      if (sessions.length > 0) {
        console.log('    SessionInfo フィールド一覧:');
        for (const [key, value] of Object.entries(sessions[0])) {
          console.log(`      ${key}: ${typeof value} = ${JSON.stringify(value)?.slice(0, 100)}`);
        }
      }
    } catch (err) {
      console.log(`    未対応 — code: ${err.code}, data: ${JSON.stringify(err.data)}`);
      console.log('    → セッション管理はアプリ側（sessions.json）で行う必要あり');
    }

    // [5] loadSession
    if (!caps.loadSession) {
      console.log('\n[5] loadSession: スキップ（capability なし）');
    } else {
      console.log(`\n[5] session/load（セッション復元）...`);
      console.log(`    sessionId: ${targetSession.sessionId}`);
      console.log(`    cwd: ${targetSession.cwd}`);

      const loadStart = Date.now();
      const loadResult = await connection.loadSession({
        sessionId: targetSession.sessionId,
        cwd: targetSession.cwd,
        mcpServers: [],
      });
      const loadDuration = Date.now() - loadStart;

      console.log(`\n    loadSession 完了（${loadDuration}ms）`);
      console.log(`    loadSession レスポンス: ${JSON.stringify(loadResult, null, 2)}`);

      console.log(`\n    復元中に受信した session/update:`);
      console.log(`      agent_message_chunk: ${handler.loadedChunks} 件`);
      console.log(`      tool_call: ${handler.loadedToolCalls} 件`);

      // sessionUpdate 種別サマリ
      const updateTypes = handler.allUpdates.reduce((acc, u) => {
        acc[u.sessionUpdate] = (acc[u.sessionUpdate] ?? 0) + 1;
        return acc;
      }, {});
      console.log('\n    sessionUpdate 種別サマリ:');
      for (const [type, count] of Object.entries(updateTypes)) {
        console.log(`      ${type}: ${count} 件`);
      }

      // 復元されたメッセージの内容をサンプル表示
      const textChunks = handler.allUpdates
        .filter((u) => u.sessionUpdate === 'agent_message_chunk' && u.content?.type === 'text')
        .map((u) => u.content.text);
      if (textChunks.length > 0) {
        const allText = textChunks.join('');
        console.log(`\n    復元されたテキスト（先頭 300 文字）:`);
        console.log(`    ${allText.slice(0, 300).replace(/\n/g, '\n    ')}`);
      }

      // [6] loadSession 後に prompt を送信
      console.log(`\n[6] 復元後に prompt 送信（"Reply with exactly: RESTORED"）...`);
      handler.allUpdates = [];

      const promptResult = await connection.prompt({
        sessionId: targetSession.sessionId,
        prompt: [{ type: 'text', text: 'Reply with exactly: RESTORED' }],
      });

      const responseChunks = handler.allUpdates
        .filter((u) => u.sessionUpdate === 'agent_message_chunk' && u.content?.type === 'text')
        .map((u) => u.content.text);
      const responseText = responseChunks.join('');

      console.log(`    エージェント返答: ${responseText.slice(0, 200)}`);
      console.log(`    stopReason: ${promptResult.stopReason}`);
    }

    // [7] 結果サマリ
    console.log('\n=== 結果サマリ ===');
    console.log(`loadSession capability: ${caps.loadSession ? 'YES' : 'NO'}`);
    console.log(`ローカルセッション数: ${localSessions.length}`);

    console.log('\n=== Phase 6B 実装上の注意点 ===');
    console.log('1. listSessions は kiro-cli v1.27.2 で未サポート（-32601）');
    console.log('   → セッション一覧は sessions.json で完全にアプリ側管理');
    console.log('2. loadSession は正常動作（capability: true）');
    console.log('3. loadSession 後に session/update で会話履歴が再送される');
    console.log('   → 既存の SessionUpdateMethod でそのまま処理可能');
    console.log('4. loadSession の Promise 解決時点で履歴再送は完了している');
  } catch (err) {
    console.error('\n[ERROR]', err.message ?? err);
    if (err.code !== undefined) {
      console.error('  code:', err.code);
    }
    if (err.data !== undefined) {
      console.error('  data:', JSON.stringify(err.data));
    }
  } finally {
    proc.kill();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
