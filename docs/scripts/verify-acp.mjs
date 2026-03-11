/**
 * ACP 動作確認スクリプト
 * kiro-cli acp を起動し、initialize → newSession → prompt の基本フローを検証する
 *
 * 使い方: node scripts/verify-acp.mjs
 */

import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

// Phase 3 で実装予定の ClientHandler の最小スタブ
class StubClientHandler {
  constructor() {
    this.events = [];
  }

  async requestPermission(params) {
    console.log('[StubClient] requestPermission called:', params.toolCall?.title ?? '(no title)');
    this.events.push({ type: 'requestPermission', params });
    // MVP: 最初のオプションを自動承認
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
    this.events.push({ type: 'sessionUpdate', update: update.sessionUpdate });
    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        if (update.content.type === 'text') {
          process.stdout.write(update.content.text);
        }
        break;
      case 'tool_call':
        console.log(
          `\n[StubClient] tool_call: ${update.title} (id=${update.toolCallId}, status=${update.status ?? 'none'})`,
        );
        break;
      case 'tool_call_update':
        console.log(
          `[StubClient] tool_call_update: id=${update.toolCallId}, status=${update.status ?? 'none'}`,
        );
        break;
      default:
        console.log(`[StubClient] sessionUpdate: ${update.sessionUpdate}`);
    }
  }

  async readTextFile(params) {
    console.log(`[StubClient] readTextFile: ${params.path}`);
    this.events.push({ type: 'readTextFile', path: params.path });
    // 存在する場合はファイル内容を返す（このスクリプト自身を読む）
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(params.path, 'utf-8');
      return { content };
    } catch {
      throw new Error(`ENOENT: no such file or directory, open '${params.path}'`);
    }
  }

  async writeTextFile(params) {
    console.log(`[StubClient] writeTextFile: ${params.path} (${params.content.length} chars)`);
    this.events.push({ type: 'writeTextFile', path: params.path });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(params.path, params.content, 'utf-8');
    return {};
  }
}

async function main() {
  console.log('=== ACP 動作確認スクリプト ===\n');

  // kiro-cli acp を起動
  console.log('[1] kiro-cli acp を起動...');
  const proc = spawn('kiro-cli', ['acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`[kiro-cli stderr] ${data}`);
  });

  proc.on('error', (err) => {
    console.error('[ERROR] kiro-cli acp の起動に失敗:', err.message);
    process.exit(1);
  });

  const readStream = Readable.toWeb(proc.stdout);
  const writeStream = Writable.toWeb(proc.stdin);
  const stream = ndJsonStream(writeStream, readStream);

  const clientHandler = new StubClientHandler();
  const connection = new ClientSideConnection((_agent) => clientHandler, stream);

  try {
    // [2] initialize
    console.log('[2] initialize...');
    const initResult = await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'kiroductor-verify', version: '0.1.0' },
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });
    console.log(`    OK - protocolVersion: ${initResult.protocolVersion}`);
    console.log(`    agentInfo: ${JSON.stringify(initResult.agentInfo ?? '(none)')}`);
    console.log(
      `    capabilities: ${JSON.stringify(initResult.agentCapabilities ?? initResult.capabilities ?? '(none)')}`,
    );

    // [3] newSession
    console.log('\n[3] session/new...');
    const sessionResult = await connection.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });
    console.log(`    OK - sessionId: ${sessionResult.sessionId}`);

    // [4] prompt（短いプロンプトで素早く完了するもの）
    console.log('\n[4] session/prompt を送信...');
    console.log('    プロンプト: "Reply with exactly: OK"\n');
    console.log('--- エージェント返答 ---');

    const promptResult = await connection.prompt({
      sessionId: sessionResult.sessionId,
      prompt: [{ type: 'text', text: 'Reply with exactly: OK' }],
    });

    console.log('\n--- 返答終了 ---');
    console.log(`\n    stopReason: ${promptResult.stopReason}`);

    // [5] 結果サマリ
    console.log('\n=== 動作確認結果 ===');
    console.log(`clientHandler が受信したイベント:`);
    for (const ev of clientHandler.events) {
      if (ev.type === 'sessionUpdate') {
        console.log(`  - sessionUpdate: ${ev.update}`);
      } else {
        console.log(`  - ${ev.type}`);
      }
    }

    const sessionUpdateTypes = clientHandler.events
      .filter((e) => e.type === 'sessionUpdate')
      .map((e) => e.update);

    console.log('\n=== Phase 3 実装上の注意点 ===');
    console.log(
      '受信した sessionUpdate の種類:',
      [...new Set(sessionUpdateTypes)].join(', ') || '(なし)',
    );
  } catch (err) {
    console.error('\n[ERROR]', err.message ?? err);
    if (err.code !== undefined) {
      console.error('  code:', err.code);
    }
  } finally {
    console.log('\n[5] kiro-cli プロセスを終了...');
    proc.kill();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
