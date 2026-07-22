import { useState, useCallback } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
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
      <text className="count">{count}</text>
      <view className="actions">
        <view className="button" bindtap={handleDecrement}>
          <text className="button-text">−</text>
        </view>
        <view className="button button--primary" bindtap={handleIncrement}>
          <text className="button-text button-text--primary">+</text>
        </view>
      </view>
    </view>
  );
}
