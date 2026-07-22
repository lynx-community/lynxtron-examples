import { useState, useEffect } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import './App.css';

interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  path: string;
}

export function App() {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const api = NativeModules.nodejs.exposed;
      const dirEntries = await api.readdir(dirPath);
      setEntries(dirEntries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      }));
      setCurrentPath(dirPath);
    } catch (err: any) {
      setError(`Error loading directory: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    const api = NativeModules.nodejs.exposed;
    loadDirectory(api.homedir());
  };

  const goUp = () => {
    const api = NativeModules.nodejs.exposed;
    const parent = api.dirname(currentPath);
    if (parent !== currentPath) {
      loadDirectory(parent);
    }
  };

  const openEntry = async (entry: DirEntry) => {
    if (entry.isDirectory) {
      loadDirectory(entry.path);
    } else {
      setLoading(true);
      setError(null);
      try {
        const api = NativeModules.nodejs.exposed;
        const content = await api.readFile(entry.path);
        setSelectedFile(entry.path);
        setFileContent(content);
      } catch (err: any) {
        setError(`Error reading file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };





  useEffect(() => {
    goHome();
  }, []);

  if (selectedFile) {
    const api = NativeModules.nodejs.exposed;
    return (
      <view className="container">
        <view className="header">
          <text className="title" text-maxline="1">{api.basename(selectedFile)}</text>
          <view className="back-button" bindtap={() => setSelectedFile(null)}>
            <text className="button-text">Back</text>
          </view>
        </view>
        <scroll-view scroll-y className="file-content">
          <text className="content-text">{fileContent}</text>
        </scroll-view>
        {error && <text className="error">{error}</text>}
      </view>
    );
  }

  return (
    <view className="container">
      <view className="header">
        <text className="title">File Explorer</text>
        <view className="nav-buttons">
          <view className="nav-button" bindtap={goHome}>
            <text className="button-text">Home</text>
          </view>
          <view className="nav-button" bindtap={goUp}>
            <text className="button-text">Up</text>
          </view>
        </view>
      </view>
      <view className="path-bar">
        <text className="path-text" text-maxline="1">{currentPath}</text>
      </view>
      <scroll-view scroll-y className="file-list">
        {loading && <text className="loading">reading dir…</text>}
        {entries.map((entry) => (
          <view
            key={entry.path}
            className={`list-item ${entry.isDirectory ? 'directory' : 'file'}`}
            bindtap={() => openEntry(entry)}
          >
            <text className="item-name" text-maxline="1">{entry.name}</text>
            <text className="item-kind">{entry.isDirectory ? 'folder' : 'file'}</text>
          </view>
        ))}
      </scroll-view>
      {error && <text className="error">{error}</text>}
    </view>
  );
}
