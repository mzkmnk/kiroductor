/**
 * ACP マルチセッション動作確認スクリプト
 * 1つの ClientSideConnection で複数セッションを同時に管理できるか検証する。
 *
 * 検証項目:
 *   1. newSession() を2回呼び、2つのセッション ID を取得できるか
 *   2. 逐次 prompt: セッション A → B の順で prompt を送信し、それぞれ正しく応答を得られるか
 *   3. session/update の sessionId ルーティング: 各 update が正しいセッション ID を持つか
 *   4. 並行 prompt: 2つのセッションに同時に prompt を送信した場合の挙動
 *   5. loadSession 後の別セッションへの prompt: セッション切替が正しく動作するか
 *
 * 使い方: node docs/scripts/verify-acp-multisession.mjs
 */

import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

class MultiSessionClientHandler {
  constructor() {
    /** @type {Map<string, Array<{sessionUpdate: string, content?: unknown}>>} */
    this.updatesBySession = new Map();
    /** @type {Array<{sessionId: string|undefined, update: unknown}>} */
    this.rawUpdates = [];
  }

  async requestPermission(params) {
    const firstOption = params.options[0];
    return {
      outcome: { outcome: 'selected', optionId: firstOption.optionId },
    };
  }

  async sessionUpdate(params) {
    const { sessionId, update } = params;
    this.rawUpdates.push({ sessionId, update });

    if (!this.updatesBySession.has(sessionId)) {
      this.updatesBySession.set(sessionId, []);
    }
    this.updatesBySession.get(sessionId).push(update);
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

  /**
   * 特定セッションのテキストチャンクを結合して返す。
   */
  getResponseText(sessionId) {
    const updates = this.updatesBySession.get(sessionId) ?? [];
    return updates
      .filter((u) => u.sessionUpdate === 'agent_message_chunk' && u.content?.type === 'text')
      .map((u) => u.content.text)
      .join('');
  }

  /**
   * sessionId が undefined/null の update があるか確認する。
   */
  getOrphanedUpdates() {
    return this.rawUpdates.filter((u) => !u.sessionId);
  }

  clearUpdates() {
    this.updatesBySession.clear();
    this.rawUpdates = [];
  }
}

function printResult(label, passed, detail = '') {
  const mark = passed ? '\u2705' : '\u274c';
  console.log(`  ${mark} ${label}${detail ? ': ' + detail : ''}`);
}

async function main() {
  console.log('=== ACP マルチセッション動作確認 ===\n');

  // kiro-cli acp を起動
  console.log('[0] kiro-cli acp を起動...');
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

  const handler = new MultiSessionClientHandler();
  const connection = new ClientSideConnection((_agent) => handler, stream);

  const results = [];

  try {
    // initialize
    console.log('[1] initialize...');
    await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'kiroductor-multisession-verify', version: '0.1.0' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });
    console.log('    OK\n');

    // ============================================================
    // テスト 1: 2つのセッションを作成
    // ============================================================
    console.log('[テスト1] 2つのセッションを作成...');
    const sessionA = await connection.newSession({ cwd: process.cwd(), mcpServers: [] });
    console.log(`    セッション A: ${sessionA.sessionId}`);

    const sessionB = await connection.newSession({ cwd: process.cwd(), mcpServers: [] });
    console.log(`    セッション B: ${sessionB.sessionId}`);

    const uniqueIds = sessionA.sessionId !== sessionB.sessionId;
    printResult('異なるセッション ID が返される', uniqueIds);
    results.push({ name: '2セッション作成', passed: uniqueIds });

    // ============================================================
    // テスト 2: 逐次 prompt（セッション A → B）
    // ============================================================
    console.log('\n[テスト2] 逐次 prompt...');
    handler.clearUpdates();

    // セッション A に prompt
    console.log('    セッション A に prompt: "Reply with exactly: ALPHA"');
    const resultA = await connection.prompt({
      sessionId: sessionA.sessionId,
      prompt: [{ type: 'text', text: 'Reply with exactly: ALPHA' }],
    });
    const responseA = handler.getResponseText(sessionA.sessionId);
    console.log(`    セッション A 返答: "${responseA.trim()}"`);
    console.log(`    stopReason: ${resultA.stopReason}`);

    // セッション B に prompt
    console.log('    セッション B に prompt: "Reply with exactly: BETA"');
    const resultB = await connection.prompt({
      sessionId: sessionB.sessionId,
      prompt: [{ type: 'text', text: 'Reply with exactly: BETA' }],
    });
    const responseB = handler.getResponseText(sessionB.sessionId);
    console.log(`    セッション B 返答: "${responseB.trim()}"`);
    console.log(`    stopReason: ${resultB.stopReason}`);

    const seqPromptOk = resultA.stopReason === 'end_turn' && resultB.stopReason === 'end_turn';
    printResult('逐次 prompt が両方 end_turn で完了', seqPromptOk);
    results.push({ name: '逐次 prompt', passed: seqPromptOk });

    // ============================================================
    // テスト 3: session/update の sessionId ルーティング
    // ============================================================
    console.log('\n[テスト3] session/update の sessionId ルーティング...');
    const orphaned = handler.getOrphanedUpdates();
    const noOrphans = orphaned.length === 0;
    printResult(
      'sessionId が undefined の update がない',
      noOrphans,
      `orphaned: ${orphaned.length}`,
    );

    const aUpdates = handler.updatesBySession.get(sessionA.sessionId) ?? [];
    const bUpdates = handler.updatesBySession.get(sessionB.sessionId) ?? [];
    const bothHaveUpdates = aUpdates.length > 0 && bUpdates.length > 0;
    printResult(
      '両セッションに update が届いている',
      bothHaveUpdates,
      `A: ${aUpdates.length}, B: ${bUpdates.length}`,
    );
    results.push({ name: 'sessionId ルーティング', passed: noOrphans && bothHaveUpdates });

    // ============================================================
    // テスト 4: 並行 prompt
    // ============================================================
    console.log('\n[テスト4] 並行 prompt...');
    handler.clearUpdates();

    console.log('    セッション A, B に同時に prompt を送信...');
    let concurrentOk = false;
    let concurrentDetail = '';
    try {
      const [concResultA, concResultB] = await Promise.all([
        connection.prompt({
          sessionId: sessionA.sessionId,
          prompt: [{ type: 'text', text: 'Reply with exactly: PARALLEL_A' }],
        }),
        connection.prompt({
          sessionId: sessionB.sessionId,
          prompt: [{ type: 'text', text: 'Reply with exactly: PARALLEL_B' }],
        }),
      ]);

      const concRespA = handler.getResponseText(sessionA.sessionId);
      const concRespB = handler.getResponseText(sessionB.sessionId);
      console.log(`    セッション A 返答: "${concRespA.trim()}"`);
      console.log(`    セッション B 返答: "${concRespB.trim()}"`);
      console.log(`    stopReason: A=${concResultA.stopReason}, B=${concResultB.stopReason}`);

      concurrentOk = concResultA.stopReason === 'end_turn' && concResultB.stopReason === 'end_turn';
      concurrentDetail = 'Both completed';

      // 並行時の sessionId ルーティング確認
      const concOrphaned = handler.getOrphanedUpdates();
      if (concOrphaned.length > 0) {
        concurrentDetail += `, but ${concOrphaned.length} orphaned updates`;
        concurrentOk = false;
      }
    } catch (err) {
      concurrentOk = false;
      concurrentDetail = `Error: ${err.message ?? err}`;
      if (err.code !== undefined) {
        concurrentDetail += ` (code: ${err.code})`;
      }
      console.log(`    エラー発生: ${concurrentDetail}`);
    }

    printResult('並行 prompt が成功', concurrentOk, concurrentDetail);
    results.push({ name: '並行 prompt', passed: concurrentOk });

    // ============================================================
    // テスト 5: セッション A を load 後にセッション B へ prompt
    // ============================================================
    console.log('\n[テスト5] loadSession 後の別セッションへの prompt...');
    handler.clearUpdates();

    let loadSwitchOk = false;
    let loadSwitchDetail = '';
    try {
      console.log(`    セッション A をロード...`);
      await connection.loadSession({
        sessionId: sessionA.sessionId,
        cwd: process.cwd(),
        mcpServers: [],
      });
      console.log('    セッション A ロード完了');

      const loadedUpdatesA = handler.updatesBySession.get(sessionA.sessionId) ?? [];
      console.log(`    復元中に受信した update 数（A）: ${loadedUpdatesA.length}`);

      handler.clearUpdates();

      // ロード後にセッション B へ prompt
      console.log('    セッション B に prompt: "Reply with exactly: AFTER_LOAD"');
      const afterLoadResult = await connection.prompt({
        sessionId: sessionB.sessionId,
        prompt: [{ type: 'text', text: 'Reply with exactly: AFTER_LOAD' }],
      });
      const afterLoadResp = handler.getResponseText(sessionB.sessionId);
      console.log(`    セッション B 返答: "${afterLoadResp.trim()}"`);
      console.log(`    stopReason: ${afterLoadResult.stopReason}`);

      loadSwitchOk = afterLoadResult.stopReason === 'end_turn';
      loadSwitchDetail = `B responded after A load`;
    } catch (err) {
      loadSwitchDetail = `Error: ${err.message ?? err}`;
      if (err.code !== undefined) {
        loadSwitchDetail += ` (code: ${err.code})`;
      }
      console.log(`    エラー発生: ${loadSwitchDetail}`);
    }

    printResult('loadSession 後の別セッション prompt', loadSwitchOk, loadSwitchDetail);
    results.push({ name: 'loadSession 後の別セッション prompt', passed: loadSwitchOk });

    // ============================================================
    // 結果サマリ
    // ============================================================
    console.log('\n=== 結果サマリ ===');
    const allPassed = results.every((r) => r.passed);
    for (const r of results) {
      printResult(r.name, r.passed);
    }

    console.log(
      `\n結論: ${allPassed ? '1つの接続で複数セッションの同時管理は問題なし' : '一部テストが失敗 — 詳細を確認してください'}`,
    );

    if (!allPassed) {
      console.log('\n=== Phase 6C への影響 ===');
      const failedConcurrent = !results.find((r) => r.name === '並行 prompt')?.passed;
      if (failedConcurrent) {
        console.log(
          '- 並行 prompt が失敗: kiro-cli は同時に1セッションしか prompt を処理できない可能性あり',
        );
        console.log('  → Phase 6C では逐次的にセッション切替を行う設計が安全');
        console.log('  → UI 側でアクティブセッション以外の prompt をブロックする');
      }
    }
  } catch (err) {
    console.error('\n[ERROR]', err.message ?? err);
    if (err.code !== undefined) console.error('  code:', err.code);
    if (err.data !== undefined) console.error('  data:', JSON.stringify(err.data));
  } finally {
    console.log('\nkiro-cli プロセスを終了...');
    proc.kill();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
