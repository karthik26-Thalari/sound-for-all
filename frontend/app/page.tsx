'use client';

import { useState } from 'react';
import ClarityTab from '@/components/ClarityTab';
import AlertsTab from '@/components/AlertsTab';
import SlowSpeechTab from '@/components/SlowSpeechTab';
import ClassifierTab from '@/components/ClassifierTab';
import LiveCallTab from '@/components/LiveCallTab';

const TABS = [
  { id: 'clarity', label: 'Clarity', index: '01', Comp: ClarityTab },
  { id: 'alerts', label: 'Alerts', index: '02', Comp: AlertsTab },
  { id: 'slow', label: 'Slow speech', index: '03', Comp: SlowSpeechTab },
  { id: 'classify', label: "What's that sound?", index: '04', Comp: ClassifierTab },
  { id: 'call', label: 'Live call', index: '05', Comp: LiveCallTab },
] as const;

export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('clarity');
  const Active = TABS.find((t) => t.id === tab)!.Comp;

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="wordmark">Sound for All</div>
        <div className="tagline">
          Speech clearer, not louder — backed up with sight and touch.
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Feature tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="tab-btn"
            onClick={() => setTab(t.id)}
          >
            <span className="tab-index" aria-hidden="true">{t.index}</span> {t.label}
          </button>
        ))}
      </nav>

      <Active />

      <footer className="credits">
        Built for elderly hearing-aid users — not Deaf/sign-language users, who
        existing accessibility tools already serve well.
      </footer>
    </main>
  );
}
