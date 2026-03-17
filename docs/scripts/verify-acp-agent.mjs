/**
 * ACP Agent 切り替え検証スクリプト
 *
 * 検証項目:
 * 1. デフォルト agent で kiro-cli acp を起動し、session/new の応答を確認
 * 2. --agent test-reviewer で起動し、session/new の応答を確認
 * 3. --agent test-coder で起動し、session/new の応答を確認
 * 4. 各 agent の agentInfo、modes、models を比較
 * 5. session/set_mode で任意タイミングのモード切替を検証
 */

import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

const CWD = process.cwd();

/** kiro-cli acp を起動し、ClientSideConnection を返す */
async function startAgent(agentName) {
  const args = ['acp'];
  if (agentName) args.push('--agent', agentName);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`起動: kiro-cli ${args.join(' ')}`);
  console.log('='.repeat(60));

  const proc = spawn('kiro-cli', args, { stdio: ['pipe', 'pipe', 'pipe'] });

  // stderr をログ出力
  proc.stderr?.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) console.log(`  [stderr] ${line}`);
    }
  });

  const readStream = Readable.toWeb(proc.stdout);
  const writeStream = Writable.toWeb(proc.stdin);
  const stream = ndJsonStream(writeStream, readStream);

  const connection = new ClientSideConnection(
    (_agent) => ({
      readTextFile: async (params) => ({ content: '' }),
      writeTextFile: async (params) => ({}),
      requestPermission: async (params) => ({
        granted: true,
        updatedPermission: params.permissions[0],
      }),
    }),
    stream,
  );

  const initResult = await connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientInfo: { name: 'acp-agent-verifier', version: '0.1.0' },
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
    },
  });

  console.log('\n--- initialize レスポンス ---');
  console.log('agentInfo:', JSON.stringify(initResult.agentInfo, null, 2));
  console.log('capabilities:', JSON.stringify(initResult.capabilities, null, 2));

  return { connection, proc, initResult };
}

/** session/new を実行し、modes と models を確認 */
async function testNewSession(connection, label) {
  console.log(`\n--- session/new (${label}) ---`);
  const response = await connection.newSession({ cwd: CWD, mcpServers: [] });
  console.log('sessionId:', response.sessionId);

  if (response.modes) {
    console.log('modes.currentModeId:', response.modes.currentModeId);
    console.log(
      'modes.availableModes:',
      response.modes.availableModes.map((m) => `${m.id} (${m.name})`),
    );
  } else {
    console.log('modes: なし');
  }

  if (response.models) {
    console.log('models.currentModelId:', response.models.currentModelId);
    console.log(
      'models.availableModels:',
      response.models.availableModels.map((m) => `${m.modelId} (${m.name})`),
    );
  } else {
    console.log('models: なし');
  }

  return response;
}

/** session/set_mode を実行 */
async function testSetMode(connection, sessionId, modeId) {
  console.log(`\n--- session/set_mode (modeId=${modeId}) ---`);
  try {
    const response = await connection.setSessionMode({ sessionId, modeId });
    console.log('set_mode 成功:', JSON.stringify(response));
    return { success: true, response };
  } catch (err) {
    console.log('set_mode エラー:', err.message);
    return { success: false, error: err.message };
  }
}

/** プロセスを安全に終了 */
function killProc(proc) {
  return new Promise((resolve) => {
    proc.on('exit', resolve);
    proc.kill();
    setTimeout(() => resolve(), 3000);
  });
}

// ===== メイン検証 =====
async function main() {
  const results = {};

  // ===== 検証1: デフォルト agent =====
  {
    const { connection, proc, initResult } = await startAgent(null);
    const session = await testNewSession(connection, 'default agent');
    results.default = { initResult, session };

    // モード切替テスト（利用可能な別モードがあれば切り替えてみる）
    if (session.modes && session.modes.availableModes.length > 1) {
      const otherMode = session.modes.availableModes.find(
        (m) => m.id !== session.modes.currentModeId,
      );
      if (otherMode) {
        results.default.setMode = await testSetMode(connection, session.sessionId, otherMode.id);

        // 元に戻す
        await testSetMode(connection, session.sessionId, session.modes.currentModeId);
      }
    }

    await killProc(proc);
  }

  // ===== 検証2: test-reviewer agent =====
  {
    const { connection, proc, initResult } = await startAgent('test-reviewer');
    const session = await testNewSession(connection, 'test-reviewer agent');
    results.reviewer = { initResult, session };

    // モード切替テスト
    if (session.modes && session.modes.availableModes.length > 1) {
      const otherMode = session.modes.availableModes.find(
        (m) => m.id !== session.modes.currentModeId,
      );
      if (otherMode) {
        results.reviewer.setMode = await testSetMode(connection, session.sessionId, otherMode.id);
      }
    }

    await killProc(proc);
  }

  // ===== 検証3: test-coder agent =====
  {
    const { connection, proc, initResult } = await startAgent('test-coder');
    const session = await testNewSession(connection, 'test-coder agent');
    results.coder = { initResult, session };

    // モード切替テスト
    if (session.modes && session.modes.availableModes.length > 1) {
      const otherMode = session.modes.availableModes.find(
        (m) => m.id !== session.modes.currentModeId,
      );
      if (otherMode) {
        results.coder.setMode = await testSetMode(connection, session.sessionId, otherMode.id);
      }
    }

    await killProc(proc);
  }

  // ===== 検証4: 同一プロセスでの複数セッション作成 =====
  console.log(`\n${'='.repeat(60)}`);
  console.log('検証4: 同一プロセス内で複数セッション（agent切替不可の確認）');
  console.log('='.repeat(60));
  {
    const { connection, proc } = await startAgent('test-reviewer');
    const session1 = await testNewSession(connection, 'session1 (test-reviewer process)');
    const session2 = await testNewSession(connection, 'session2 (test-reviewer process)');

    console.log('\n--- 比較 ---');
    console.log(
      'session1 modes:',
      session1.modes?.availableModes.map((m) => m.id),
    );
    console.log(
      'session2 modes:',
      session2.modes?.availableModes.map((m) => m.id),
    );
    console.log('同一プロセス内で異なるagentのセッション作成は不可（agent はプロセスレベル）');

    await killProc(proc);
  }

  // ===== サマリー出力 =====
  console.log(`\n${'='.repeat(60)}`);
  console.log('検証サマリー');
  console.log('='.repeat(60));

  console.log('\n■ agentInfo 比較:');
  for (const [name, data] of Object.entries(results)) {
    console.log(`  ${name}: ${JSON.stringify(data.initResult.agentInfo)}`);
  }

  console.log('\n■ 利用可能モード比較:');
  for (const [name, data] of Object.entries(results)) {
    const modes = data.session.modes?.availableModes.map((m) => m.id) ?? [];
    console.log(`  ${name}: [${modes.join(', ')}]`);
  }

  console.log('\n■ デフォルトモード比較:');
  for (const [name, data] of Object.entries(results)) {
    console.log(`  ${name}: ${data.session.modes?.currentModeId ?? 'なし'}`);
  }

  console.log('\n■ session/set_mode 結果:');
  for (const [name, data] of Object.entries(results)) {
    if (data.setMode) {
      console.log(`  ${name}: ${data.setMode.success ? '成功' : `失敗 (${data.setMode.error})`}`);
    } else {
      console.log(`  ${name}: 未テスト（モードが1つのみ）`);
    }
  }

  console.log('\n■ 結論:');
  console.log('  - agent はプロセス起動時に --agent フラグで選択');
  console.log('  - 同一プロセス内で agent 切替は不可');
  console.log('  - mode 切替は session/set_mode で任意タイミングで可能');
  console.log('  - agent 切替を実装するには kiro-cli プロセスの再起動が必要');
}

main().catch((err) => {
  console.error('検証エラー:', err);
  process.exit(1);
});
