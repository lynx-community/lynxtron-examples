import { app, devtool, LynxWindow, lynxBridge } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: number;
}

function resolveDbPath(): string {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'todos.db');
  } catch {
    const dir = path.join(process.env.HOME ?? '/tmp', '.lynxtron-todolist');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'todos.db');
  }
}

app.whenReady().then(() => {
  try { devtool.setDevToolEnabled(true); } catch (e) { console.warn('devtool.setDevToolEnabled failed:', e); }
  const dbPath = resolveDbPath();
  const db = new sqlite3.Database(dbPath);
  db.serialize();

  const dbReady = new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      (err) => (err ? reject(err) : resolve()),
    );
  });

  const run = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });

  const all = <T>(sql: string, params: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
    });

  async function listTodos(): Promise<Todo[]> {
    const rows = await all<{ id: number; title: string; completed: number; created_at: number }>(
      'SELECT id, title, completed, created_at FROM todos ORDER BY id DESC',
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      completed: Boolean(r.completed),
      createdAt: r.created_at,
    }));
  }

  const w = new LynxWindow({
    width: 480,
    height: 640,
    title: 'Todo List',
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  function wrap(fn: (data: any) => Promise<unknown> | unknown) {
    return async (_event: any, data: any) => {
      try {
        await dbReady;
        return await fn(data);
      } catch (err: any) {
        console.error('[todolist] bridge error:', err?.message);
        return { error: err?.message ?? String(err) };
      }
    };
  }

  lynxBridge.handle('storePath', wrap(() => dbPath));
  lynxBridge.handle('list', wrap(() => listTodos()));
  lynxBridge.handle(
    'add',
    wrap(async (data) => {
      const title = String(data?.title ?? '').trim();
      if (!title) return listTodos();
      await run('INSERT INTO todos (title, completed, created_at) VALUES (?, 0, ?)', [title, Date.now()]);
      return listTodos();
    }),
  );
  lynxBridge.handle(
    'toggle',
    wrap(async (data) => {
      await run(
        'UPDATE todos SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END WHERE id = ?',
        [data?.id],
      );
      return listTodos();
    }),
  );
  lynxBridge.handle(
    'remove',
    wrap(async (data) => {
      await run('DELETE FROM todos WHERE id = ?', [data?.id]);
      return listTodos();
    }),
  );
  lynxBridge.handle(
    'clearCompleted',
    wrap(async () => {
      await run('DELETE FROM todos WHERE completed = 1');
      return listTodos();
    }),
  );

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);
  nudgeFramedWindowViewport(w);
});
