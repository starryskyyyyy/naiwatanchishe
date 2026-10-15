// 浏览器通过HTTP接口读取榜单、提交成绩；数据库只由服务器访问。
globalThis.LeaderboardUI = (() => {
  const form = document.querySelector('#score-form');
  const nickname = document.querySelector('#nickname');
  const submitButton = document.querySelector('#submit-score');
  const submitStatus = document.querySelector('#submit-status');
  const list = document.querySelector('#leaderboard-list');
  const boardStatus = document.querySelector('#leaderboard-status');
  const refreshButton = document.querySelector('#refresh-leaderboard');
  const onPages = location.hostname.endsWith('.github.io');
  const baseUrl = String(globalThis.SnakeConfig?.apiBaseUrl || '').trim().replace(/\/+$/,'');
  let validBase = !baseUrl;
  if(baseUrl)try {
    const url=new URL(baseUrl);
    validBase=!url.username && !url.password && !url.search && !url.hash &&
      (url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)));
  } catch { /* 配置错误时不发出请求 */ }
  const connected = ['http:','https:'].includes(location.protocol) && validBase && (!onPages || !!baseUrl);
  const localHint = !validBase ? '排行榜连接配置有误，请联系站点作者。' : onPages ?
    '排行榜服务尚未连接，暂时无法提交成绩；游戏和本局计分仍可正常使用。' :
    '请先运行 npm start，再打开 http://localhost:3000 使用排行榜。';
  let currentRound;
  let readVersion = 0;
  try { nickname.value = localStorage.getItem('snake-nickname') || ''; } catch { /* 本机记忆不可用时仍可填写 */ }

  async function request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),10000);
    try {
      const response = await fetch(baseUrl+url,{...options,signal:controller.signal});
      let body;
      try { body = await response.json(); } catch { throw new Error('服务器响应异常，请稍后重试'); }
      if (!response.ok) throw new Error(body.error || '请求失败，请稍后重试');
      return body;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('网络超时，请重试；同一局不会重复保存。');
      if (error instanceof TypeError) throw new Error('连接失败，请检查网络或确认服务器正在运行。');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function renderEntries(entries) {
    list.replaceChildren();
    for (const entry of entries) {
      const row = document.createElement('li');
      for (const [className, value] of [['rank',entry.rank],['player-name',entry.nickname],['player-score',entry.score]]) {
        const cell = document.createElement('span'); cell.className = className;
        // 用户昵称永远作为文字显示，不执行其中的HTML。
        cell.textContent = value; row.append(cell);
      }
      list.append(row);
    }
    boardStatus.textContent = entries.length ? '已收录 ' + entries.length + ' / 20 局 · ' + new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) + ' 更新' : '榜单还是空的，来留下第一份成绩吧。';
  }
  async function refresh() {
    if (!connected) { boardStatus.textContent = localHint; refreshButton.disabled = true; return; }
    const version = ++readVersion;
    refreshButton.disabled = true;
    boardStatus.textContent = '正在读取排行榜…';
    try {
      const body = await request('/api/leaderboard');
      if (version === readVersion) renderEntries(body.entries);
    } catch (error) { if (version === readVersion) boardStatus.textContent = error.message + ' 点击刷新可重试。'; }
    finally { if (version === readVersion) refreshButton.disabled = false; }
  }
  function startRound() {
    // 新一局使用新UUID；失败重试始终使用当前局原来的UUID。
    currentRound = {submissionId: globalThis.crypto?.randomUUID?.() || null, score:null, pending:false, complete:false};
    form.hidden = !connected; nickname.disabled = false; nickname.setCustomValidity('');
    submitButton.disabled = true; submitButton.textContent = '提交本局成绩';
    submitStatus.textContent = connected ? '只保存进入前20名的成绩。' : localHint;
  }
  function endRound(score) {
    currentRound.score = score;
    submitButton.disabled = !connected || !currentRound.submissionId;
    if (!connected) submitStatus.textContent = localHint;
    else if (!currentRound.submissionId) submitStatus.textContent = '请使用 localhost 或 HTTPS 打开页面，再提交成绩。';
    else submitStatus.textContent = '输入昵称提交本局成绩，仅保存全站前20名。';
  }

  nickname.addEventListener('input',() => nickname.setCustomValidity(''));
  form.addEventListener('submit',async event => {
    event.preventDefault();
    const state = currentRound;
    if (!connected || !state || state.score === null || !state.submissionId || state.pending || state.complete) return;
    const name = nickname.value.trim();
    if (!name || [...name].length > 20 || /\p{Cc}/u.test(name)) {
      nickname.setCustomValidity('请填写1～20个字符的昵称，不能包含控制字符。'); nickname.reportValidity(); return;
    }
    // 网络失败后保留第一次提交的内容，避免服务端已保存但客户端未收到时改名重试。
    if (!state.payload) state.payload = {submissionId:state.submissionId,nickname:name,score:state.score};
    nickname.value = state.payload.nickname;
    state.pending = true; nickname.disabled = true; submitButton.disabled = true;
    submitButton.textContent = '提交中…'; submitStatus.textContent = '正在确认排名…';
    const boardVersion = readVersion;
    try {
      const result = await request('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.payload)});
      state.complete = true;
      // 旧局响应或请求期间已刷新的榜单，不能用较早的快照覆盖。
      if (state !== currentRound) { refresh(); return; }
      if (boardVersion === readVersion) {
        ++readVersion; renderEntries(result.entries); refreshButton.disabled = false;
      } else refresh();
      try { localStorage.setItem('snake-nickname',state.payload.nickname); } catch { /* 记忆昵称不影响成绩保存 */ }
      submitStatus.textContent = result.qualified ? '成绩已保存！当前排名第 ' + result.rank + ' 名。' : '本局未进入前20名，成绩未保存。再挑战一次吧！';
      submitButton.textContent = result.qualified ? '本局已提交 ✓' : '本局未入榜';
    } catch (error) {
      if (state !== currentRound) return;
      submitStatus.textContent = error.message;
      submitButton.textContent = '重试提交';
      submitButton.disabled = false;
      // 保持昵称锁定，确保重试内容一致。重新开始可填写新的昵称。
    } finally { state.pending = false; }
  });
  refreshButton.addEventListener('click',refresh);
  refresh();
  return {startRound,endRound};
})();
