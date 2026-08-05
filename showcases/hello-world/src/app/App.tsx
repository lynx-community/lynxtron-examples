import { useEffect, useState } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import './App.css';

export function App() {
  const [greeting, setGreeting] = useState('Hello, World!');

  useEffect(() => {
    const bridge = globalThis as unknown as { hello?: { greet: (name: string) => string } };
    const reply = bridge.hello?.greet('Lynxtron');
    if (reply) {
      setGreeting(reply);
    }
  }, []);

  return (
    <view className="container">
      <text className="title">hello world</text>
      <text className="greeting">{greeting}</text>
    </view>
  );
}
