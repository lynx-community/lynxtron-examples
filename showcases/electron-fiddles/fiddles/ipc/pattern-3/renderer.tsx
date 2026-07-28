import { root, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles ipc/pattern-3 (main → renderer).
// Electron drives the counter from an application-menu item; here the same
// update-counter events are pushed from main and can also be nudged from the UI.
export function App() {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const off = onGlobalEvent('update-counter', (delta: number) => {
      setCounter((prev) => {
        const next = prev + Number(delta);
        bridgeSend('counter-value', { value: next });
        return next;
      });
    });
    return off;
  }, []);

  return (
    <DemoPage title="IPC: Main → Renderer" supports="Pattern 3 · pushed events"
      apis={['Menu.buildFromTemplate', 'Menu.setApplicationMenu', 'app.getName']}>
      <Section heading="Menu-driven counter">
        <ResultText>Current value: {counter}</ResultText>
        <Row>
          <ActionButton label="Increment (menu)" onTap={() => bridgeSend('nudge', { delta: 1 })} />
          <ActionButton label="Decrement (menu)" onTap={() => bridgeSend('nudge', { delta: -1 })} variant="secondary" />
        </Row>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
