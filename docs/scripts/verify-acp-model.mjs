/**
 * ACP モデル切り替え動作確認スクリプト
 *
 * 検証項目:
 *   1. newSession レスポンスに models が含まれるか
 *   2. unstable_setSessionModel() が kiro-cli で動作するか
 *   3. モデル切り替え後の prompt() が新モデルで応答するか
 *
 * 使い方:
 *   node docs/scripts/verify-acp-model.mjs
 */

import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

class SimpleClientHandler {
  constructor() {
    this.updates = [];
  }

  async requestPermission(params) {
    const firstOption = params.options[0];
    return { outcome: { outcome: 'selected', optionId: firstOption.optionId } };
  }

  async sessionUpdate(params) {
    this.updates.push(params.update);
  }

  async readTextFile(params) {
    const { readFile } = await import('node:fs/promises');
    try {
      return { content: await readFile(params.path, 'utf-8') };
    } catch {
      throw new Error(`ENOENT: ${params.path}`);
    }
  }

  async writeTextFile(params) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(params.path, params.content, 'utf-8');
    return {};
  }

  async extNotification(_method, _params) {}

  getResponseText() {
    return this.updates
      .filter((u) => u.sessionUpdate === 'agent_message_chunk' && u.content?.type === 'text')
      .map((u) => u.content.text)
      .join('');
  }
}

async function main() {
  console.log('=== ACP モデル切り替え動作確認 ===\n');

  const proc = spawn('kiro-cli', ['acp'], { stdio: ['pipe', 'pipe', 'pipe'] });

  proc.stderr.on('data', (data) => process.stderr.write(`[stderr] ${data}`));
  proc.on('error', (err) => {
    console.error('[ERROR] kiro-cli acp の起動に失敗:', err.message);
    process.exit(1);
  });

  const stream = ndJsonStream(Writable.toWeb(proc.stdin), Readable.toWeb(proc.stdout));
  const handler = new SimpleClientHandler();
  const connection = new ClientSideConnection((_agent) => handler, stream);

  try {
    // [1] initialize
    console.log('[1] initialize...');
    const initResult = await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'kiroductor-model-verify', version: '0.1.0' },
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
    });
    console.log(`    OK - protocolVersion: ${initResult.protocolVersion}`);

    // [2] newSession — models フィールドを確認
    console.log('\n[2] newSession — models フィールド確認...');
    const cwd = process.cwd();
    const newSessionResult = await connection.newSession({ cwd, mcpServers: [] });
    const sessionId = newSessionResult.sessionId;
    console.log(`    sessionId: ${sessionId}`);

    const models = newSessionResult.models;
    if (models) {
      console.log(`    ✅ models フィールドあり`);
      console.log(`    currentModelId: ${models.currentModelId}`);
      console.log(`    availableModels (${models.availableModels?.length ?? 0} 件):`);
      for (const m of models.availableModels ?? []) {
        console.log(`      - ${m.modelId}: ${m.name}${m.description ? ` (${m.description})` : ''}`);
      }
    } else {
      console.log(`    ❌ models フィールドなし（null または undefined）`);
    }

    // newSession の全フィールドを表示
    console.log(`\n    newSession レスポンス全体:`);
    console.log(
      JSON.stringify(newSessionResult, null, 2)
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n'),
    );

    // [3] unstable_setSessionModel — 動作確認
    const availableModels = models?.availableModels ?? [];
    const targetModel =
      availableModels.find((m) => m.modelId !== models?.currentModelId && m.modelId !== 'auto') ??
      availableModels[0];

    if (!targetModel) {
      console.log('\n[3] unstable_setSessionModel: スキップ（availableModels が空）');
    } else {
      console.log(
        `\n[3] unstable_setSessionModel — ${models?.currentModelId} → ${targetModel.modelId}...`,
      );
      try {
        const setModelResult = await connection.unstable_setSessionModel({
          sessionId,
          modelId: targetModel.modelId,
        });
        console.log(`    ✅ 成功 レスポンス: ${JSON.stringify(setModelResult)}`);

        // [4] モデル切り替え後に prompt を送信してモデル名を確認
        console.log(
          `\n[4] 切り替え後に prompt 送信（"What model are you? Reply in one sentence."）...`,
        );
        handler.updates = [];
        const promptResult = await connection.prompt({
          sessionId,
          prompt: [{ type: 'text', text: 'What model are you? Reply in one sentence.' }],
        });
        const responseText = handler.getResponseText();
        console.log(`    エージェント返答: ${responseText.slice(0, 300)}`);
        console.log(`    stopReason: ${promptResult.stopReason}`);
      } catch (err) {
        console.log(`    ❌ 失敗 — code: ${err.code}, message: ${err.message}`);
        if (err.data !== undefined) {
          console.log(`    data: ${JSON.stringify(err.data)}`);
        }
      }
    }

    // [5] 結果サマリ
    console.log('\n=== 結果サマリ ===');
    console.log(`newSession に models フィールド: ${models ? 'YES' : 'NO'}`);
    console.log(`currentModelId: ${models?.currentModelId ?? '(なし)'}`);
    console.log(`availableModels 数: ${models?.availableModels?.length ?? 0}`);
    console.log(`unstable_setSessionModel: 上記 [3] の結果を参照`);
  } catch (err) {
    console.error('\n[ERROR]', err.message ?? err);
    if (err.code !== undefined) console.error('  code:', err.code);
    if (err.data !== undefined) console.error('  data:', JSON.stringify(err.data));
  } finally {
    proc.kill();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
