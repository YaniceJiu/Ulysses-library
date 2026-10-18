/**
 * AI 生成队列：并发=1（防 API 过载）+ 轮询 + 超时 + 自动重试
 * api 接口契约（可注入，便于测试）：
 *   await api.create(photoPath) -> { remoteId }
 *   await api.poll(remoteId)    -> { status: 'running'|'done'|'failed', result?, error? }
 *   result = { url, dimensions: {x,y,z}, triangles }
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkErr(msg, code) {
  const e = new Error(msg);
  e.code = code;
  return e;
}

class GenerationQueue {
  constructor(config, api, hooks = {}) {
    this.config = config;
    this.api = api;
    this.hooks = hooks; // { onDone(task), onFailed(task) }
    this.queue = [];      // 等待中的任务
    this.active = null;   // 正在运行的任务
    this.jobs = new Map(); // taskId -> task
  }

  // 入队，返回 taskId
  generate(job) {
    const taskId = job.taskId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task = {
      taskId,
      photoId: job.photoId,
      photoPath: job.photoPath,
      room: job.room,
      owner: job.owner,
      ownerName: job.ownerName,
      name: job.name,
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
      startedAt: 0,
      result: null,
      error: null,
      finishedAt: null,
    };
    this.jobs.set(taskId, task);
    this.queue.push(task);
    this._pump();
    return taskId;
  }

  getStatus(taskId) {
    const t = this.jobs.get(taskId);
    if (!t) return null;
    return {
      taskId,
      status: t.status,
      error: t.error,
      result: t.result,
      attempts: t.attempts,
    };
  }

  _pump() {
    if (this.active || this.queue.length === 0) return;
    const task = this.queue.shift();
    this.active = task;
    this._run(task);
  }

  async _run(task) {
    if (!task.startedAt) task.startedAt = Date.now();
    task.status = 'processing';
    task.attempts += 1;
    try {
      // 1) 提交远程任务
      const { remoteId } = await this.api.create(task.photoPath);
      task.remoteId = remoteId;
      // 2) 轮询直到完成/失败/超时
      while (true) {
        if (Date.now() - task.startedAt > this.config.genTimeoutMs) {
          throw mkErr('生成超时，请重拍', 'TIMEOUT');
        }
        await sleep(this.config.pollMs);
        const st = await this.api.poll(remoteId);
        if (st.status === 'done') {
          task.result = st.result;
          this._finish(task, true);
          return;
        }
        if (st.status === 'failed') {
          throw mkErr(st.error || '生成失败，请重拍', 'GEN_FAILED');
        }
      }
    } catch (err) {
      // 3) 重试策略：次数内自动重试
      if (task.attempts <= this.config.genRetries) {
        task.status = 'retrying';
        await sleep(this.config.retryBackoffMs);
        return this._run(task);
      }
      this._finish(task, false, err);
    }
  }

  _finish(task, ok, err) {
    task.status = ok ? 'done' : 'failed';
    task.error = err ? err.message : null;
    task.finishedAt = Date.now();
    this.active = null;
    if (this.hooks.onDone && ok) this.hooks.onDone(task);
    if (this.hooks.onFailed && !ok) this.hooks.onFailed(task);
    this._pump(); // 跑下一个
  }

  // 在线玩家数量（不在这里，仅为占位清晰）——queue 不关心
}

module.exports = { GenerationQueue, sleep };
