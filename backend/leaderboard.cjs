const { DatabaseSync } = require('node:sqlite');
const { MAX_SCORE } = require('../game-rules.js');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, '提交内容必须是对象');
  const { score, submissionId } = input;
  if (typeof input.nickname !== 'string') throw new HttpError(400, '请填写昵称');
  const nickname = input.nickname.trim();
  if ([...nickname].length < 1 || [...nickname].length > 20 || /\p{Cc}/u.test(nickname)) {
    throw new HttpError(400, '昵称需要1～20个字符，且不能包含控制字符');
  }
  if (!Number.isSafeInteger(score) || score < 0 || score > MAX_SCORE) {
    throw new HttpError(400, '成绩必须是0～' + MAX_SCORE + '之间的整数');
  }
  if (typeof submissionId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(submissionId)) {
    throw new HttpError(400, '本局标识无效，请重新开始游戏');
  }
  return { nickname, score, submissionId: submissionId.toLowerCase() };
}

class Leaderboard {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA secure_delete = ON;
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL UNIQUE,
        nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 20),
        score INTEGER NOT NULL CHECK(score BETWEEN 0 AND ${MAX_SCORE}),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS scores_ranking ON scores(score DESC, id ASC);
    `);
  }
  list() {
    return this.db.prepare('SELECT nickname, score, created_at FROM scores ORDER BY score DESC, id ASC LIMIT 20')
      .all().map((row, i) => ({ rank: i + 1, nickname: row.nickname, score: row.score, createdAt: row.created_at }));
  }
  submit(input) {
    const { nickname, score, submissionId } = validateSubmission(input);
    // 写锁覆盖检查、写入、淘汰全过程，防止并发时榜单超过20条。
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db.prepare('SELECT id,nickname,score FROM scores WHERE submission_id=?').get(submissionId);
      let qualified = true;
      let id = existing?.id;
      if (existing) {
        if (existing.nickname !== nickname || existing.score !== score) throw new HttpError(409, '这一局已经提交，请勿更改内容');
      } else {
        const cutoff = this.db.prepare('SELECT score FROM scores ORDER BY score DESC,id ASC LIMIT 1 OFFSET 19').get();
        if (cutoff && score <= cutoff.score) qualified = false;
        else {
          id = this.db.prepare('INSERT INTO scores(submission_id,nickname,score,created_at) VALUES(?,?,?,?)')
            .run(submissionId, nickname, score, new Date().toISOString()).lastInsertRowid;
          this.db.exec('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC,id ASC LIMIT 20)');
        }
      }
      const entries = this.list();
      const rank = qualified ? this.db.prepare('SELECT count(*) AS n FROM scores WHERE score > ? OR (score = ? AND id <= ?)').get(score, score, id).n : null;
      this.db.exec('COMMIT');
      return { qualified, rank, duplicate: Boolean(existing), entries };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close() { this.db.close(); }
}
module.exports = { Leaderboard, HttpError };
