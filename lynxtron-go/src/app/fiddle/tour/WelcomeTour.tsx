import { useState } from '@lynx-js/react';
import { Button, Dialog } from '../bp';
import './WelcomeTour.css';

export interface WelcomeTourProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Lynxtron Fiddle',
    body: 'Fiddle is the fastest way to prototype a Lynxtron desktop app. Edit code, hit Run, see it live.',
  },
  {
    title: 'Start from a template',
    body: 'Click New to pick a starter — Blank, Hello Lynxtron, or one of the showcases from the registry.',
  },
  {
    title: 'Run your fiddle',
    body: 'Press Run to spawn a fresh Lynxtron process against your current files. Console output streams into the top pane.',
  },
  {
    title: 'Share a gist',
    body: 'Paste a GitHub gist URL into the address bar to load. Save publishes back (coming soon).',
  },
];

export function WelcomeTour(props: WelcomeTourProps) {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  const next = () => {
    if (isLast) props.onClose();
    else setIdx(i => i + 1);
  };
  const prev = () => setIdx(i => Math.max(0, i - 1));

  const footer = (
    <>
      <Button text="Skip" minimal onClick={props.onClose} />
      <Button text="Back" disabled={idx === 0} onClick={prev} />
      <Button text={isLast ? 'Get Started' : 'Next'} intent="primary" onClick={next} />
    </>
  );

  return (
    <Dialog isOpen={props.isOpen} title={step.title} onClose={props.onClose} width={520} footer={footer}>
      <view className="WelcomeTour">
        <text className="WelcomeTour-Body">{step.body}</text>
        <view className="WelcomeTour-Dots">
          {STEPS.map((_, i) => (
            <view key={i} className={'WelcomeTour-Dot' + (i === idx ? ' WelcomeTour-Dot--active' : '')} />
          ))}
        </view>
      </view>
    </Dialog>
  );
}
