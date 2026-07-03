import { useState, useCallback } from '@lynx-js/react';
import './App.css';

export function App() {
  const [count, setCount] = useState(0);

  const handleIncrement = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  const handleDecrement = useCallback(() => {
    setCount((c) => c - 1);
  }, []);

  return (
    <view className="container">
      <text className="title">Counter: {count}</text>
      <view className="actions">
        <view className="button" bindtap={handleDecrement}>
          <text className="button-text">-</text>
        </view>
        <view className="button" bindtap={handleIncrement}>
          <text className="button-text">+</text>
        </view>
      </view>
    </view>
  );
}
