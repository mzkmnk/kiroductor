/**
 * ACP 詳細動作確認スクリプト
 * ContentChunk の messageId、ToolCall の構造、ToolCallUpdate の構造を確認する
 *
 * 使い方: node scripts/verify-acp-detail.mjs
 */

import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

class InspectClientHandler {
  constructor() {
    this.allUpdates = [];
  }

  async requestPermission(params) {
    console.log('\n[requestPermission] options:', JSON.stringify(params.options, null, 2));
    console.log('[requestPermission] toolCall:', JSON.stringify(params.toolCall, null, 2));
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
      // messageId フィールドの有無を確認
      process.stdout.write(update.content.type === 'text' ? update.content.text : `[${update.content.type}]`);
    } else {
      // tool_call, tool_call_update などは全フィールドを表示
      console.log(`\n\n[${update.sessionUpdate}]`, JSON.stringify(update, null, 2));
    }
  }

  async readTextFile(params) {
    console.log(`\n[readTextFile] path=${params.path}, line=${params.line}, limit=${params.limit}`);
    const { readFile } = await import('node:fs/promises');
    try {
      const content = await readFile(params.path, 'utf-8');
      return { content };
    } catch {
      throw new Error(`ENOENT: ${params.path}`);
    }
  }

  async writeTextFile(params) {
    console.log(`\n[writeTextFile] path=${params.path}`);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(params.path, params.content, 'utf-8');
    return {};
  }

  // Kiro 拡張通知を明示的に受け取る（extNotification が実装されていれば -32601 エラーが出ない）
  async extNotification(method, params) {
    if (!method.startsWith('_kiro.dev/')) {
      console.log(`[extNotification] ${method}:`, JSON.stringify(params).slice(0, 100));
    }
    // _kiro.dev/ 拡張は無視
  }
}

async function main() {
  console.log('=== ACP 詳細動作確認 ===\n');

  const proc = spawn('kiro-cli', ['acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`[stderr] ${data}`);
  });

  const readStream = Readable.toWeb(proc.stdout);
  const writeStream = Writable.toWeb(proc.stdin);
  const stream = ndJsonStream(writeStream, readStream);

  const handler = new InspectClientHandler();
  const connection = new ClientSideConnection((_agent) => handler, stream);

  try {
    await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'kiroductor-inspect', version: '0.1.0' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });
    console.log('[initialize] OK\n');

    const { sessionId } = await connection.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });
    console.log(`[newSession] sessionId=${sessionId}\n`);

    // ツール呼び出しを確実に発生させるプロンプト
    console.log('[prompt] "What is in the file scripts/verify-acp.mjs? Read it and list its first 3 lines."\n');
    console.log('--- エージェント返答 ---');

    const result = await connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'What is in the file scripts/verify-acp.mjs? Read it and list its first 3 lines.' }],
    });

    console.log('\n--- 返答終了 ---');
    console.log(`stopReason: ${result.stopReason}\n`);

    // messageId の確認
    const chunks = handler.allUpdates.filter((u) => u.sessionUpdate === 'agent_message_chunk');
    const messageIds = [...new Set(chunks.map((c) => c.messageId ?? '(undefined)'))];
    console.log('\n=== ContentChunk.messageId の確認 ===');
    console.log(`受信した agent_message_chunk 数: ${chunks.length}`);
    console.log(`ユニークな messageId 値: ${messageIds.join(', ')}`);

    // ToolCall の確認
    const toolCalls = handler.allUpdates.filter((u) => u.sessionUpdate === 'tool_call');
    console.log('\n=== ToolCall フィールドの確認 ===');
    if (toolCalls.length > 0) {
      const tc = toolCalls[0];
      console.log('  toolCallId:', tc.toolCallId);
      console.log('  title:', tc.title);
      console.log('  name フィールド:', 'name' in tc ? tc.name : '(存在しない)');
      console.log('  status:', tc.status);
      console.log('  rawInput 型:', typeof tc.rawInput);
    } else {
      console.log('  ToolCall なし（ツール未呼び出し）');
    }

    // ToolCallUpdate の確認
    const toolUpdates = handler.allUpdates.filter((u) => u.sessionUpdate === 'tool_call_update');
    console.log('\n=== ToolCallUpdate フィールドの確認 ===');
    if (toolUpdates.length > 0) {
      for (const tu of toolUpdates) {
        console.log('  toolCallId:', tu.toolCallId);
        console.log('  status:', tu.status);
        console.log('  rawOutput type:', typeof tu.rawOutput);
      }
    } else {
      console.log('  ToolCallUpdate なし');
    }

    // 全 sessionUpdate 種別サマリ
    const updateTypes = handler.allUpdates.reduce((acc, u) => {
      acc[u.sessionUpdate] = (acc[u.sessionUpdate] ?? 0) + 1;
      return acc;
    }, {});
    console.log('\n=== 受信した sessionUpdate 種別 ===');
    for (const [type, count] of Object.entries(updateTypes)) {
      console.log(`  ${type}: ${count}件`);
    }

  } catch (err) {
    console.error('\n[ERROR]', err.message ?? err);
  } finally {
    proc.kill();
    process.exit(0);
  }
}

main().catch(console.error);
