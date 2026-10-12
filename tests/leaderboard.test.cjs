const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
let Leaderboard;
try { ({ Leaderboard } = require('../backend/leaderboard.cjs')); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const entry = (score, nickname = '玩家', submissionId = randomUUID()) => ({ score, nickname, submissionId });
function open(t, file = ':memory:') {
  assert.ok(Leaderboard, '需要排行榜数据库模块');
  const board = new Leaderboard(file); t.after(() => board.close()); return board;
}

test('每局独立保存，昵称可重复，同分先提交者优先', t => {
  const board = open(t);
  assert.deepEqual(board.list(), []);
  board.submit(entry(100, '同一人'));
  board.submit(entry(100, '同一人'));
  board.submit(entry(200, '后来者'));
  assert.deepEqual(board.list().map(row => [row.rank, row.nickname, row.score]), [[1,'后来者',200],[2,'同一人',100],[3,'同一人',100]]);
});

test('只保留前20；不够入榜与等于第20名不插入；更高分淘汰旧记录', t => {
  const board = open(t);
  for (let i=1; i<=20; i++) board.submit(entry(i*10));
  const before = board.list();
  assert.equal(board.submit(entry(0)).qualified, false);
  assert.equal(board.submit(entry(10)).qualified, false);
  assert.deepEqual(board.list(), before);
  // sqlite_sequence也不变，证明低分未经历先插入再删除。
  assert.equal(board.db.prepare("SELECT seq FROM sqlite_sequence WHERE name='scores'").get().seq, 20);
  const result = board.submit(entry(300));
  assert.equal(result.rank, 1);
  assert.equal(board.list().length, 20);
  assert.equal(board.list().at(-1).score, 20);
  assert.equal(board.db.prepare('SELECT count(*) AS n FROM scores').get().n, 20);
});

test('同一局重试不会重复入榜，变更已提交内容被拒绝', t => {
  const board = open(t);
  const score = entry(5);
  assert.equal(board.submit(score).duplicate, false);
  const again = board.submit(score);
  assert.equal(again.duplicate, true);
  assert.equal(again.rank, 1);
  assert.equal(board.list().length, 1);
  assert.throws(() => board.submit({...score, score:6}), error => error.status === 409);
});

test('昵称与分数校验，拒绝非法值且不写库', t => {
  const board = open(t);
  for (const score of [-1, 1.5, Infinity, '100', 398]) {
    assert.throws(() => board.submit(entry(score)), error => error.status === 400);
  }
  for (const name of ['', '   ', 'a'.repeat(21), '\u0000玩家', 123]) {
    assert.throws(() => board.submit(entry(100,name)), error => error.status === 400);
  }
  assert.throws(() => board.submit(entry(100,'玩家','not-a-uuid')), error => error.status === 400);
  assert.equal(board.list().length, 0);
  board.submit(entry(0,'  小蛇  '));
  assert.equal(board.list()[0].nickname, '小蛇');
  board.submit(entry(1,'一颗苹果'));
  assert.equal(board.list()[0].score, 1);
});

test('SQL与HTML字符按普通昵称存储，公开榜单不暴露提交UUID', t => {
  const board = open(t);
  board.submit(entry(100,"<b>瓜</b>"));
  board.submit(entry(200,"'; DROP TABLE--"));
  assert.equal(board.list().length, 2);
  assert.equal(board.list()[1].nickname, '<b>瓜</b>');
  assert.equal('submissionId' in board.list()[0], false);
});

test('关闭重开仍保留成绩，同文件多连接读取一致', t => {
  assert.ok(Leaderboard);
  const file = join(mkdtempSync(join(tmpdir(),'fruit-db-')), 'scores.sqlite');
  const first = new Leaderboard(file);
  first.submit(entry(100,'持久玩家')); first.close();
  const second = open(t,file), third = open(t,file);
  assert.equal(second.list()[0].nickname,'持久玩家');
  third.submit(entry(200));
  assert.deepEqual(second.list(), third.list());
});
