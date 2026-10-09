// Run after npm run build. Uses the real Worker/API and fresh in-memory D1 only.
import { Miniflare } from 'miniflare';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = process.cwd();
async function walk(directory) {
  const files = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...await walk(file));
    else if (/\.m?js$/.test(file)) files.push(file);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(file => file !== entry)].map(file => ({ type: 'ESModule', path: file }));
const owner = { 'oai-authenticated-user-id': 'chat-atomic-fixture', 'oai-authenticated-user-email': 'chat-atomic@example.invalid' };
const other = { 'oai-authenticated-user-id': 'chat-other-fixture', 'oai-authenticated-user-email': 'chat-other@example.invalid' };

async function createFixture(t) {
  const outbound = [];
  const mf = new Miniflare({
    rootPath: root, modules, modulesRoot: 'dist/server', compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0, cf: false,
    logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'chat-atomic-synthetic' },
    d1Persist: false, assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
    outboundService: async request => {
      outbound.push(new URL(request.url).hostname);
      return new Response('External calls forbidden by synthetic test', { status: 502 });
    },
  });
  t.after(async () => { await mf.dispose(); assert.deepEqual(outbound, [], 'No external AI or other outbound calls'); });
  const d1 = await mf.getD1Database('DB');
  for (const file of (await fs.readdir('drizzle')).filter(name => name.endsWith('.sql')).sort()) {
    for (const sql of (await fs.readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint')) {
      if (sql.trim()) await d1.prepare(sql.trim()).run();
    }
  }
  const request = async (url, body, headers = owner) => {
    const response = await mf.dispatchFetch('http://preview.test' + url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, data: await response.json() };
  };
  const created = await request('/api/saju', { name: '합성 채팅 원자성', gender: 'male', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false, calendarType: 'solar' });
  assert.equal(created.response.status, 200);
  assert.equal(created.data.fortune.generation.mode, 'template');
  const id = created.data.fortune.id;
  const history = async () => (await request('/api/saju/' + id)).data.chats;
  return { id, d1, request, history };
}

test('a failed reply insert rolls back its question and a later explicit send succeeds', async t => {
  const fixture = await createFixture(t);
  await fixture.d1.prepare("CREATE TRIGGER qa_reject_reply BEFORE INSERT ON chats WHEN NEW.role='doryeong' BEGIN SELECT RAISE(ABORT, 'Synthetic reply insert failure'); END").run();
  const failed = await fixture.request('/api/saju/' + fixture.id + '/chat', { question: '합성 저장 실패 질문' });
  assert.equal(failed.response.status, 500);
  const history = await fixture.history();
  console.log(JSON.stringify({ case: 'synthetic reply insert failure', status: failed.response.status, persistedRoles: history.map(message => message.role) }));
  assert.deepEqual(history, [], 'A failed exchange must not leave a lone user question in reloaded history');
  const rowCount = await fixture.d1.prepare('SELECT COUNT(*) AS count FROM chats').first('count');
  assert.equal(rowCount, 0, 'Rollback must remove the question from actual D1 too');
  await fixture.d1.prepare('DROP TRIGGER qa_reject_reply').run();
  const sent = await fixture.request('/api/saju/' + fixture.id + '/chat', { question: '합성 복구 질문' });
  assert.equal(sent.response.status, 200);
  assert.equal(sent.data.success, true);
  assert.deepEqual((await fixture.history()).map(message => [message.role, message.content]), [['user', '합성 복구 질문'], ['doryeong', sent.data.reply]]);
});

test('concurrent sends reload as complete adjacent question/reply pairs', async t => {
  const fixture = await createFixture(t);
  const questions = ['합성 첫 질문', '합성 둘째 질문'];
  const responses = await Promise.all(questions.map(async question => ({ question, ...await fixture.request('/api/saju/' + fixture.id + '/chat', { question }) })));
  for (const result of responses) {
    assert.equal(result.response.status, 200);
    assert.equal(result.data.success, true);
  }
  const history = await fixture.history();
  console.log(JSON.stringify({ case: 'concurrent synthetic sends', persistedRoles: history.map(message => message.role) }));
  assert.equal(history.length, 4);
  assert.deepEqual(history.map(message => message.role), ['user', 'doryeong', 'user', 'doryeong']);
  assert.deepEqual(history.filter(message => message.role === 'user').map(message => message.content).sort(), [...questions].sort());
  for (let index = 0; index < history.length; index += 2) {
    const result = responses.find(response => response.question === history[index].content);
    assert.equal(history[index + 1].content, result.data.reply);
  }
});

test('invalid, anonymous, missing and cross-owner sends never write chat rows', async t => {
  const fixture = await createFixture(t);
  const url = '/api/saju/' + fixture.id + '/chat';
  assert.equal((await fixture.request(url, { question: '합성 권한 오류 질문' }, other)).response.status, 404);
  assert.equal((await fixture.request(url, { question: '합성 익명 질문' }, {})).response.status, 401);
  assert.equal((await fixture.request('/api/saju/qa-missing-fortune/chat', { question: '합성 없는 기록 질문' })).response.status, 404);
  assert.equal((await fixture.request(url, { question: ' ' })).response.status, 400);
  assert.deepEqual(await fixture.history(), []);
  assert.equal(await fixture.d1.prepare('SELECT COUNT(*) AS count FROM chats').first('count'), 0);
});
