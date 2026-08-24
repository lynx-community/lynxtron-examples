import { root, useState } from '@lynx-js/react';
import './style.css';

type InputProbeProps = {
  id: string;
  label: string;
};

function InputProbe({ id, label }: InputProbeProps) {
  const [value, setValue] = useState('');
  const [events, setEvents] = useState<string[]>([]);

  const record = (event: string) => {
    setEvents(previous => [event, ...previous].slice(0, 4));
  };

  return (
    <view className="probe">
      <text className="label">{label}</text>
      <input
        id={id}
        className="input"
        value={value}
        placeholder="Type, then paste: renderer.js"
        bindfocus={() => record('focus')}
        bindblur={() => record('blur')}
        bindselection={(event: any) => record(
          `selection ${event.detail.selectionStart}:${event.detail.selectionEnd}`,
        )}
        bindinput={(event: any) => {
          const next = event.detail.value ?? '';
          setValue(next);
          record(`input ${JSON.stringify(next)}`);
        }}
      />
      <text className="value">value: {JSON.stringify(value)}</text>
      <text className="events">events: {events.join(' | ') || '(none)'}</text>
    </view>
  );
}

function App() {
  return (
    <view className="page">
      <text className="title">Lynxtron 0.0.8 input paste A/B</text>
      <text className="instructions">
        Copy “renderer.js”. Click each field and press Cmd+V. No app key handler is installed.
      </text>

      <view className="plain-region">
        <InputProbe id="plain-input" label="A — ordinary Lynx input" />
      </view>

      <cover-view className="cover-region" event-through={true}>
        <InputProbe id="cover-input" label="B — input inside cover-view" />
      </cover-view>
    </view>
  );
}

root.render(<App />);
