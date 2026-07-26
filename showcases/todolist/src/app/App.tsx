import { useCallback, useEffect, useMemo, useState } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import './App.css';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: number;
}

type Filter = 'all' | 'active' | 'completed';

const inputValueProp = (value: string) => ({ value }) as any;
const readInputValue = (e: any): string => e?.detail?.value ?? e?.value ?? '';

function bridge<T>(name: string, data: any = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      (NativeModules as any).bridge.call(name, data, (res: any) => {
        if (res && typeof res === 'object' && 'error' in res) reject(new Error(res.error));
        else resolve(res as T);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [storePath, setStorePath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTodos(await bridge<Todo[]>('list'));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load todos');
    }
  }, []);

  useEffect(() => {
    bridge<string>('storePath').then(setStorePath).catch(() => {});
    refresh();
  }, [refresh]);

  const submit = useCallback(async () => {
    const title = input.trim();
    if (!title) return;
    try {
      setTodos(await bridge<Todo[]>('add', { title }));
      setInput('');
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add');
    }
  }, [input]);

  const toggle = useCallback(async (id: number) => {
    try {
      setTodos(await bridge<Todo[]>('toggle', { id }));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to toggle');
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      setTodos(await bridge<Todo[]>('remove', { id }));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to remove');
    }
  }, []);

  const clearCompleted = useCallback(async () => {
    try {
      setTodos(await bridge<Todo[]>('clearCompleted'));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to clear');
    }
  }, []);

  const visible = useMemo(() => {
    if (filter === 'active') return todos.filter((t) => !t.completed);
    if (filter === 'completed') return todos.filter((t) => t.completed);
    return todos;
  }, [todos, filter]);

  const remaining = todos.filter((t) => !t.completed).length;

  return (
    <view className="container">
      <view className="header">
        <text className="title">Todos</text>
        <text className="subtitle">{remaining} remaining</text>
      </view>

      <view className="input-row">
        <input
          className="input"
          placeholder="What needs to be done?"
          {...inputValueProp(input)}
          bindinput={(e: any) => setInput(readInputValue(e))}
          bindconfirm={submit}
        />
        <view className="add-button" bindtap={submit}>
          <text className="button-text">Add</text>
        </view>
      </view>

      <view className="filter-row">
        {(['all', 'active', 'completed'] as Filter[]).map((f) => (
          <view
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            bindtap={() => setFilter(f)}
          >
            <text className="filter-text">{f.charAt(0).toUpperCase() + f.slice(1)}</text>
          </view>
        ))}
      </view>

      <scroll-view scroll-y className="todo-list">
        {visible.length === 0 && (
          <text className="empty">No {filter === 'all' ? '' : filter} todos yet.</text>
        )}
        {visible.map((t) => (
          <view key={t.id} className={`todo-item ${t.completed ? 'completed' : ''}`}>
            <view className="checkbox" bindtap={() => toggle(t.id)}>
              <text className="checkbox-mark">{t.completed ? '✓' : ''}</text>
            </view>
            <text className="todo-title" text-maxline="2">
              {t.title}
            </text>
            <view className="delete-button" bindtap={() => remove(t.id)}>
              <text className="delete-mark">×</text>
            </view>
          </view>
        ))}
      </scroll-view>

      <view className="footer">
        <text className="store-path" text-maxline="1">
          {storePath}
        </text>
        {todos.some((t) => t.completed) && (
          <view className="clear-button" bindtap={clearCompleted}>
            <text className="button-text">Clear completed</text>
          </view>
        )}
      </view>

      {error && <text className="error">{error}</text>}
    </view>
  );
}
