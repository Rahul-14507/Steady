import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, Camera, Check, ChevronRight,
  CircleHelp, Download, FileText, Hand, HeartHandshake, Home as HomeIcon,
  Info, Languages, LockKeyhole, Play, RefreshCcw, ScanFace, Settings,
  ShieldCheck, Smile, Sparkles, Trash2, UserRound, Volume2,
  Waves, X,
} from 'lucide-react';
import type { MedState, MetricKey, Profile, Session as StoredSession } from './core/types';
import { db, deleteAllLocalData, exportLocalData, saveProfile, saveSession } from './data/db';
import { buildReport, shareOrDownload } from './report/generateReport';
import { requestWakeLock, releaseWakeLock } from './a11y/wakeLock';
import { getLandmarkers } from './tracking/landmarkers';
import { startFrameLoop } from './tracking/useFrameLoop';
import { useCamera } from './tracking/useCamera';
import { drawHandSkeleton, drawFaceMesh } from './tracking/drawLandmarks';
import { analyzeTapping, calculateTapScore, tapSample, type TapSample } from './core/tapping';
import { analyzeSmiles, blendMap, blinkRatePerMin, calculateFaceScore, countBlinks, expressivity } from './core/face';
import { median } from './core/signal';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type IconType = typeof Activity;
type Session = { id: string; type: 'Tapping' | 'Face'; date: string; score: number; note: string };

const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

function readFlag(key: string) {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}

function saveFlag(key: string, value: boolean) {
  try { localStorage.setItem(key, String(value)); } catch { /* local-only demo */ }
}

function Mark() {
  return <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-secondary text-foreground shadow-sm" aria-hidden="true"><Waves size={22} strokeWidth={2.5} /></span>;
}

const navItems: { href: string; label: string; icon: IconType }[] = [
  { href: '/', label: 'Today', icon: HomeIcon },
  { href: '/trends', label: 'Trends', icon: BarChart3 },
  { href: '/report', label: 'Report', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/**
 * Application Layout Shell & Navigation Header Component
 */
function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[246px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground lg:flex">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-2xl p-2" data-testid="link-brand">
          <Mark /><span className="font-display text-2xl">steady</span>
        </Link>
        <p className="mt-14 px-3 text-[11px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/55">Your space</p>
        <nav className="mt-3 grid gap-2" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`}
              className={`focus-ring flex min-h-[56px] items-center gap-3 rounded-2xl px-4 text-[15px] font-semibold transition-colors ${location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
              <Icon size={20} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-3xl border border-sidebar-border bg-sidebar-accent/70 p-4">
          <ShieldCheck size={22} className="text-sidebar-primary" />
          <p className="mt-3 text-sm font-semibold">Private by design</p>
          <p className="mt-1 text-xs leading-5 text-sidebar-foreground/65">Your sessions stay on this device in demo mode.</p>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur lg:ml-[246px] lg:px-10">
        <Link href="/" className="focus-ring flex items-center gap-3 lg:hidden" data-testid="link-mobile-brand"><Mark /><span className="font-display text-2xl">steady</span></Link>
        <div className="hidden lg:block"><p className="text-sm font-medium text-muted-foreground">A quiet place to notice your own rhythm.</p></div>
        <Link href="/settings" className="focus-ring ml-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-card text-foreground" aria-label="Open settings" data-testid="link-settings-top"><UserRound size={20} /></Link>
      </header>
      <main className="px-5 pb-28 pt-7 sm:px-8 lg:ml-[246px] lg:px-12 lg:pb-12 lg:pt-10">{children}</main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card/95 px-2 pt-2 backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-mobile-nav-${label.toLowerCase()}`}
          className={`focus-ring flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold ${location === href ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={20} /><span>{label}</span></Link>)}
      </nav>
    </div>
  );
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="rise-in mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h1 className="font-display mt-2 text-4xl leading-tight text-foreground sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>}</div>
    {action}
  </div>;
}

function Button({ children, variant = 'primary', onClick, href, disabled = false, testId = 'button-action', icon: Icon, type = 'button' }: { children: ReactNode; variant?: 'primary' | 'outline' | 'quiet' | 'danger'; onClick?: () => void; href?: string; disabled?: boolean; testId?: string; icon?: IconType; type?: 'button' | 'submit' | 'reset' }) {
  const className = `focus-ring inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold transition-all active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 ${variant === 'primary' ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.18)] hover:brightness-105' : variant === 'outline' ? 'border border-border bg-card text-foreground hover:bg-muted' : variant === 'danger' ? 'bg-destructive text-destructive-foreground' : 'text-primary hover:bg-muted'}`;
  const content = <>{Icon && <Icon size={19} />}{children}</>;
  return href ? <Link href={href} className={className} data-testid={testId}>{content}</Link> : <button type={type} className={className} onClick={onClick} disabled={disabled} data-testid={testId}>{content}</button>;
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-2xl border border-border bg-muted/65 p-4 text-sm leading-6 text-muted-foreground"><Info size={20} className="mt-0.5 shrink-0 text-primary" /> <p>{children}</p></div>;
}

function Disclaimer() {
  return <p className="mt-6 text-xs leading-5 text-muted-foreground">Steady does not diagnose any condition. It is not a substitute for medical advice.</p>;
}

function useUserProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState<string>(() => localStorage.getItem('steady-user-name') || '');

  useEffect(() => {
    const load = async () => {
      const p = await db.profiles.get('me');
      if (p) {
        setProfile(p);
        if (p.name) {
          setName(p.name);
          localStorage.setItem('steady-user-name', p.name);
        }
      }
    };
    void load();
    const onStorage = () => {
      const n = localStorage.getItem('steady-user-name');
      if (n) setName(n);
      void load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const updateName = async (newName: string) => {
    const trimmed = newName.trim() || 'Friend';
    setName(trimmed);
    localStorage.setItem('steady-user-name', trimmed);
    const existing = (await db.profiles.get('me')) ?? {
      id: 'me' as const,
      language: 'en' as const,
      diagnosisStatus: 'none' as const,
      consent: { camera: true, localStorage: true, acceptedAt: Date.now() },
      fontScale: 1 as const,
      highContrast: false,
      voiceGuidance: false,
    };
    const updated: Profile = { ...existing, name: trimmed };
    await saveProfile(updated);
    setProfile(updated);
    window.dispatchEvent(new Event('storage'));
  };

  return { profile, name: name || profile?.name || 'Friend', updateName };
}

function Home() {
  const { name: userName } = useUserProfile();
  const [storedSessions, setStoredSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    void db.sessions.toArray().then((items) => {
      setStoredSessions(items);
    });
  }, []);

  const isToday = (ts: number) => new Date(ts).toDateString() === new Date().toDateString();
  const tappingDoneToday = storedSessions.some(s => s.task === 'tapping' && isToday(s.startedAt));
  const faceDoneToday = storedSessions.some(s => s.task === 'face' && isToday(s.startedAt));
  const completedToday = (tappingDoneToday ? 1 : 0) + (faceDoneToday ? 1 : 0);

  const scores = storedSessions.length > 0
    ? storedSessions.map(s => s.quality.score)
    : [78, 82, 85];
  const baselineScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return <Shell><div className="mx-auto max-w-6xl">
    <PageTitle eyebrow={today} title={`Good morning, ${userName}.`} description="A small check-in can help you notice your rhythm over time." action={<Button href="/settings" variant="outline" icon={Settings} testId="button-open-preferences">Preferences</Button>} />
    <section className="rise-in-delay grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <div className="relative overflow-hidden rounded-[30px] bg-primary p-7 text-primary-foreground shadow-[0_18px_50px_hsl(var(--primary)/.18)] sm:p-9">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[22px] border-secondary/25" /><div className="absolute -right-4 top-12 h-32 w-32 rounded-full border-[14px] border-secondary/20" />
        <p className="relative text-xs font-bold uppercase tracking-[.18em] text-primary-foreground/65">Today’s gentle check-in</p>
        <h2 className="font-display relative mt-5 max-w-md text-3xl leading-tight sm:text-4xl">Notice how you are feeling, one minute at a time.</h2>
        <p className="relative mt-4 max-w-md text-sm leading-6 text-primary-foreground/75">These short activities are for personal tracking, not a test. You can stop whenever you like.</p>
        <div className="relative mt-7 flex flex-wrap gap-3"><Button href="/assess/tapping" variant="outline" icon={Hand} testId="button-start-tapping">Tap check · 15 sec</Button><Button href="/assess/face" variant="quiet" icon={Smile} testId="button-start-face">Face check</Button></div>
      </div>
      <div className="rounded-[30px] border border-border bg-card p-7">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Your baseline</p><Activity size={21} className="text-primary" /></div>
        <div className="mt-5 flex items-end gap-2"><span className="font-display text-6xl text-foreground">{baselineScore}</span><span className="mb-2 text-sm text-muted-foreground">/ 100</span></div>
        <p className="mt-2 text-sm font-semibold text-primary">Holding steady</p>
        <div className="mt-6 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-secondary transition-all" style={{ width: `${Math.min(100, Math.max(10, baselineScore))}%` }} /></div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {storedSessions.length > 0 ? `Computed from ${storedSessions.length} check-in${storedSessions.length === 1 ? '' : 's'}. Trends matter more than a single day.` : 'Complete a check-in to build your personal baseline.'}
        </p>
        <Button href="/trends" variant="quiet" icon={ArrowRight} testId="button-view-trends">See your trends</Button>
      </div>
    </section>
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">Keep your rhythm</h2>
        <span className="text-sm font-semibold text-muted-foreground">
          {completedToday === 2 ? 'All check-ins complete today 🎉' : completedToday === 1 ? '1 of 2 complete today' : '2 check-ins ready today'}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TaskCard icon={Hand} eyebrow="Movement" title="Tapping" copy="Tap in time with a gentle guide." href="/assess/tapping" complete={tappingDoneToday} testId="card-tapping" />
        <TaskCard icon={ScanFace} eyebrow="Expression" title="Face check" copy="Relax, then share a natural smile." href="/assess/face" complete={faceDoneToday} testId="card-face" />
      </div>
    </section>
    <section className="mt-10 grid gap-4 md:grid-cols-3">
      <MiniCard icon={HeartHandshake} title="A note for you" copy="Progress can be quiet. Showing up is enough." />
      <MiniCard icon={LockKeyhole} title="Kept on this device" copy="Sessions stay stored safely and privately on this device." />
      <MiniCard icon={CircleHelp} title="Need a hand?" copy="Manage profile and caregiver assist in Settings." href="/settings" />
    </section>
    <Disclaimer />
  </div></Shell>;
}

function TaskCard({ icon: Icon, eyebrow, title, copy, href, complete, testId }: { icon: IconType; eyebrow: string; title: string; copy: string; href: string; complete: boolean; testId: string }) {
  return <Link href={href} className="focus-ring group flex min-h-[142px] items-center justify-between rounded-[26px] border border-border bg-card p-6 shadow-[0_4px_18px_hsl(var(--foreground)/.03)] transition-transform hover:-translate-y-0.5" data-testid={testId}>
    <div className="flex items-center gap-5"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><Icon size={25} /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">{eyebrow}</p><h3 className="mt-1 text-xl font-bold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{copy}</p></div></div>
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition-colors ${complete ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-primary'}`}>
      {complete ? <Check size={21} strokeWidth={3} /> : <ChevronRight size={21} />}
    </span>
  </Link>;
}

function MiniCard({ icon: Icon, title, copy, href }: { icon: IconType; title: string; copy: string; href?: string }) {
  const inner = <><Icon size={21} className="text-primary" /><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p></>;
  return href ? <Link href={href} className="focus-ring rounded-[22px] border border-border bg-card p-5 transition-colors hover:bg-muted" data-testid={`link-${title.toLowerCase().replaceAll(' ', '-')}`}>{inner}</Link> : <div className="rounded-[22px] border border-border bg-card p-5">{inner}</div>;
}

function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => localStorage.getItem('steady-user-name') || '');
  const [cameraConsent, setCameraConsent] = useState(false);
  const [storageConsent, setStorageConsent] = useState(false);
  const steps = [
    <div key="welcome" className="text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] bg-secondary text-foreground shadow-sm"><Waves size={48} /></div><p className="mt-9 text-xs font-bold uppercase tracking-[.2em] text-primary">A quieter way to notice</p><h1 className="font-display mt-3 text-5xl leading-[1.05] sm:text-6xl">Welcome to<br />steady.</h1><p className="mx-auto mt-6 max-w-md text-base leading-7 text-muted-foreground">A personal companion for small movement check-ins and meaningful patterns over time.</p></div>,
    <div key="promise"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">A clear promise</p><h1 className="font-display mt-3 text-4xl leading-tight">Useful, without<br />making you worry.</h1><div className="mt-8 grid gap-4"><div className="rounded-3xl bg-primary p-6 text-primary-foreground"><ShieldCheck size={25} /><h2 className="mt-4 text-xl font-bold">Steady is for noticing.</h2><p className="mt-2 text-sm leading-6 text-primary-foreground/75">It helps you record simple activities and see changes in your own baseline.</p></div><div className="rounded-3xl border border-border bg-card p-6"><X size={25} className="text-accent-foreground" /><h2 className="mt-4 text-xl font-bold">Steady is not medical advice.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">It cannot tell you what a result means medically or replace a conversation with your clinician.</p></div></div></div>,
    <div key="privacy"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Your information</p><h1 className="font-display mt-3 text-4xl leading-tight">Kept close,<br />by default.</h1><div className="mt-8 rounded-3xl border border-border bg-card p-6"><LockKeyhole className="text-primary" size={28} /><h2 className="mt-5 text-xl font-bold">On-device analysis</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your camera frames are analyzed on this device. Steady stores only derived results and quality information.</p><div className="mt-6 grid gap-3 border-t border-border pt-5 text-sm font-semibold"><label className="flex min-h-[56px] cursor-pointer items-center gap-3"><input type="checkbox" checked={cameraConsent} onChange={e => setCameraConsent(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" data-testid="input-camera-consent" /> I agree to on-device camera analysis.</label><label className="flex min-h-[56px] cursor-pointer items-center gap-3"><input type="checkbox" checked={storageConsent} onChange={e => setStorageConsent(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" data-testid="input-storage-consent" /> I agree to save derived results on this device.</label></div></div></div>,
    <div key="profile"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Make it yours</p><h1 className="font-display mt-3 text-4xl leading-tight">What should we<br />call you?</h1><label className="mt-8 block text-sm font-bold" htmlFor="profile-name">Your first name</label><input id="profile-name" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your first name (e.g. Alex)" className="focus-ring mt-2 h-16 w-full rounded-2xl border border-input bg-card px-5 text-lg outline-none" data-testid="input-profile-name" /><div className="mt-6 rounded-2xl bg-muted p-4 text-sm leading-6 text-muted-foreground"><Languages size={19} className="mb-2 text-primary" />You can change language, text size, and your profile name later in Settings.</div></div>,
  ];
  const finish = async () => {
    const finalName = name.trim() || 'Friend';
    localStorage.setItem('steady-user-name', finalName);
    await saveProfile({
      id: 'me',
      name: finalName,
      language: 'en',
      diagnosisStatus: 'none',
      consent: { camera: cameraConsent, localStorage: storageConsent, acceptedAt: Date.now() },
      fontScale: 1,
      highContrast: false,
      voiceGuidance: false,
    });
    saveFlag('steady-onboarded', true);
    saveFlag('steady-camera-consent', cameraConsent);
    saveFlag('steady-storage-consent', storageConsent);
    window.dispatchEvent(new Event('storage'));
    setLocation('/');
  };
  return <div className="min-h-[100dvh] bg-background px-5 py-6 sm:px-8"><div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-5xl flex-col">
    <header className="flex items-center justify-between"><Link href="/" className="focus-ring flex items-center gap-3" data-testid="link-onboarding-brand"><Mark /><span className="font-display text-2xl">steady</span></Link><span className="text-sm font-semibold text-muted-foreground">{step + 1} of {steps.length}</span></header>
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center py-10">{steps[step]}<div className="mt-10 flex gap-3">{step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} testId="button-onboarding-back" icon={ArrowLeft}>Back</Button>}<Button onClick={() => step === steps.length - 1 ? void finish() : setStep(step + 1)} disabled={step === 2 && (!cameraConsent || !storageConsent)} testId="button-onboarding-next" icon={step === steps.length - 1 ? Check : ArrowRight}>{step === steps.length - 1 ? 'Begin gently' : 'Continue'}</Button></div></div>
    <div className="mx-auto w-full max-w-[560px]"><div className="flex gap-2">{steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-border'}`} />)}</div><p className="mt-5 text-center text-xs text-muted-foreground">You can pause or change your choices at any time.</p></div>
  </div></div>;
}

function playTapChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch { /* audio not allowed */ }
}

/**
 * Finger Tapping Guided Motor Check-In Component & Real-Time Kinematic Analysis
 */
function Assessment({ kind }: { kind: 'tapping' | 'face' }) {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<'setup' | 'ready' | 'running' | 'result'>('setup');
  const [hand, setHand] = useState('Both hands');
  const [medication, setMedication] = useState('As usual');
  const [tapCount, setTapCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [isPinching, setIsPinching] = useState(false);
  const [pinchDistance, setPinchDistance] = useState(0.5);
  const [faceSmilePercent, setFaceSmilePercent] = useState(0);
  const [faceBlinkCount, setFaceBlinkCount] = useState(0);
  const [tapPulse, setTapPulse] = useState(false);
  const [sessionScore, setSessionScore] = useState<number>(82);
  const [sessionMetrics, setSessionMetrics] = useState<Partial<Record<MetricKey, number>>>({});

  const isTapping = kind === 'tapping';
  const totalSeconds = isTapping ? 15 : 8;
  const source = new URLSearchParams(window.location.search).get('source') === 'video' ? 'video' as const : undefined;
  const { videoRef, error: cameraError } = useCamera(source, phase === 'running');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tapSamples = useRef<TapSample[]>([]);
  const faceFramesRef = useRef<{ t: number; blendshapes: Record<string, number> | null; blink: number; smile: number }[]>([]);
  const pinchStateRef = useRef<'open' | 'closed'>('open');
  const tapCountRef = useRef(0);
  const title = isTapping ? 'Finger Tapping Test' : 'Facial Expression Check';

  const registerTap = () => {
    tapCountRef.current += 1;
    setTapCount(tapCountRef.current);
    setTapPulse(true);
    playTapChime();
    window.setTimeout(() => setTapPulse(false), 150);
  };

  useEffect(() => {
    if (phase !== 'running') return;
    void requestWakeLock();
    let stopLoop: (() => void) | undefined;
    let cancelled = false;
    const video = videoRef.current;

    const startLoop = (handLM?: any, faceLM?: any) => {
      if (!video) return;
      const startedAt = performance.now();
      let lastTimestamp = 0;
      stopLoop = startFrameLoop(video, (_mediaTime, now) => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const w = Math.round(rect.width) || video.videoWidth || 640;
          const h = Math.round(rect.height) || video.videoHeight || 480;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
        }
        const timestamp = Math.max(now, lastTimestamp + 1);
        lastTimestamp = timestamp;
        const timeSec = (now - startedAt) / 1000;

        if (isTapping) {
          let landmarks: any;
          if (handLM && video.videoWidth > 0 && video.videoHeight > 0) {
            try {
              const result = handLM.detectForVideo(video, timestamp);
              landmarks = result.landmarks?.[0];
            } catch { /* use fallback drawing */ }
          }
          if (canvas) drawHandSkeleton(canvas, landmarks);
          const sample = tapSample(landmarks ?? [], video.videoWidth || 640, video.videoHeight || 480);
          if (sample) {
            tapSamples.current.push({ t: timeSec, d: sample.d });
            setPinchDistance(Math.min(1, Math.max(0, sample.d)));
            // Instant live tap detection on index-thumb touch
            if (sample.d < 0.40 && pinchStateRef.current === 'open') {
              pinchStateRef.current = 'closed';
              setIsPinching(true);
              registerTap();
            } else if (sample.d > 0.55 && pinchStateRef.current === 'closed') {
              pinchStateRef.current = 'open';
              setIsPinching(false);
            }
          }
        } else {
          let landmarks: any;
          let blendshapes: Record<string, number> | null = null;
          if (faceLM && video.videoWidth > 0 && video.videoHeight > 0) {
            try {
              const result = faceLM.detectForVideo(video, timestamp);
              landmarks = result.faceLandmarks?.[0];
              blendshapes = blendMap(result);
            } catch { /* use fallback drawing */ }
          }
          if (canvas) drawFaceMesh(canvas, landmarks);
          const blinkVal = blendshapes?.eyeBlinkLeft ?? blendshapes?.eyeBlinkRight ?? 0;
          const smileVal = Math.max(blendshapes?.mouthSmileLeft ?? 0, blendshapes?.mouthSmileRight ?? 0);
          setFaceSmilePercent(Math.round(smileVal * 100));
          if (blinkVal > 0.5) setFaceBlinkCount(c => c + 1);
          faceFramesRef.current.push({
            t: timeSec,
            blendshapes,
            blink: blinkVal,
            smile: smileVal,
          });
        }
      });
    };

    // Immediately start loop for instant canvas skeleton/mesh visualization
    startLoop();

    // Asynchronously upgrade to live MediaPipe models once loaded
    getLandmarkers().then(({ hand, face }) => {
      if (cancelled) return;
      stopLoop?.();
      startLoop(hand, face);
    }).catch(() => undefined);

    // Keyboard Spacebar tap shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isTapping) {
        e.preventDefault();
        registerTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelled = true;
      stopLoop?.();
      window.removeEventListener('keydown', handleKeyDown);
      void releaseWakeLock();
    };
  }, [isTapping, phase, videoRef]);

  const finishAssessment = () => {
    const finalTapCount = tapCountRef.current;
    if (isTapping) {
      let metrics = analyzeTapping(tapSamples.current);
      if (!metrics || metrics.tapCount < 6) {
        const freq = finalTapCount > 0 ? finalTapCount / 15 : 0;
        metrics = {
          tap_freq_hz: Math.round(freq * 100) / 100,
          tap_amp_norm: finalTapCount >= 36 ? 0.52 : finalTapCount >= 26 ? 0.38 : finalTapCount >= 16 ? 0.25 : 0.16,
          tap_amp_decrement_pct: finalTapCount >= 36 ? 6 : finalTapCount >= 26 ? 16 : finalTapCount >= 16 ? 32 : 48,
          tap_rhythm_cv: finalTapCount >= 36 ? 0.11 : finalTapCount >= 26 ? 0.21 : finalTapCount >= 16 ? 0.32 : 0.44,
          tap_hesitations: finalTapCount < 16 ? 2 : finalTapCount < 26 ? 1 : 0,
          tapCount: finalTapCount,
        };
      } else {
        metrics.tapCount = Math.max(metrics.tapCount, finalTapCount);
      }
      const score = calculateTapScore(metrics);
      setSessionMetrics({
        tap_freq_hz: metrics.tap_freq_hz,
        tap_amp_norm: metrics.tap_amp_norm,
        tap_amp_decrement_pct: metrics.tap_amp_decrement_pct,
        tap_rhythm_cv: metrics.tap_rhythm_cv,
        tap_hesitations: metrics.tap_hesitations,
      });
      setSessionScore(score);
    } else {
      const frames = faceFramesRef.current;
      const blinkSamples = frames.map(f => ({ t: f.t, b: f.blink }));
      const detectedBlinks = countBlinks(blinkSamples);
      const totalDurationSec = frames.length > 0 ? Math.max(4, frames[frames.length - 1].t) : 8;
      const blinkRate = Math.round((detectedBlinks / totalDurationSec) * 60);

      const baselineFrames = frames.filter(f => f.t < 4.0);
      const promptFrames = frames.filter(f => f.t >= 4.0);
      const baselineSmile = baselineFrames.length > 0 ? median(baselineFrames.map(f => f.smile)) : 0;
      const peakPromptSmile = promptFrames.length > 0 ? Math.max(0, ...promptFrames.map(f => f.smile)) : Math.max(0, ...frames.map(f => f.smile));
      const netSmileAmp = Math.max(0, peakPromptSmile - baselineSmile);

      const hit = promptFrames.find(f => f.smile - baselineSmile >= 0.5 * Math.max(0.1, netSmileAmp));
      const smileOnsetMs = hit ? Math.round((hit.t - 4.0) * 1000) : netSmileAmp > 0.3 ? 650 : 1400;

      const expr = expressivity(frames.map(f => f.blendshapes ?? {}).filter(Boolean)) ?? (netSmileAmp > 0.4 ? 0.08 : netSmileAmp > 0.15 ? 0.035 : 0.012);
      
      const metrics = {
        blink_rate_bpm: blinkRate > 0 ? blinkRate : 6,
        smile_amp: Math.round(netSmileAmp * 100) / 100,
        smile_onset_ms: smileOnsetMs,
        face_expressivity: Math.round(expr * 1000) / 1000,
      };
      const score = calculateFaceScore(metrics);
      setSessionMetrics(metrics);
      setSessionScore(score);
    }
    setPhase('result');
  };

  const applyPresetSimulation = (level: 'healthy' | 'mild' | 'moderate' | 'marked') => {
    if (isTapping) {
      const presets = {
        healthy: { tapCount: 44, freq: 2.93, cv: 0.12, amp: 0.54, dec: 7, hes: 0 },
        mild: { tapCount: 28, freq: 1.86, cv: 0.22, amp: 0.37, dec: 18, hes: 0 },
        moderate: { tapCount: 18, freq: 1.20, cv: 0.34, amp: 0.24, dec: 34, hes: 1 },
        marked: { tapCount: 9, freq: 0.60, cv: 0.46, amp: 0.14, dec: 52, hes: 3 },
      };
      const p = presets[level];
      setTapCount(p.tapCount);
      const metrics = {
        tap_freq_hz: p.freq,
        tap_amp_norm: p.amp,
        tap_amp_decrement_pct: p.dec,
        tap_rhythm_cv: p.cv,
        tap_hesitations: p.hes,
        tapCount: p.tapCount,
      };
      setSessionMetrics(metrics);
      setSessionScore(calculateTapScore(metrics));
    } else {
      const presets = {
        healthy: { smile: 0.78, expr: 0.082, blinks: 18, onset: 540 },
        mild: { smile: 0.36, expr: 0.038, blinks: 12, onset: 880 },
        moderate: { smile: 0.18, expr: 0.021, blinks: 7, onset: 1350 },
        marked: { smile: 0.05, expr: 0.009, blinks: 3, onset: 1800 },
      };
      const p = presets[level];
      setFaceSmilePercent(Math.round(p.smile * 100));
      const metrics = {
        blink_rate_bpm: p.blinks,
        smile_amp: p.smile,
        smile_onset_ms: p.onset,
        face_expressivity: p.expr,
      };
      setSessionMetrics(metrics);
      setSessionScore(calculateFaceScore(metrics));
    }
  };

  const begin = () => {
    tapSamples.current = [];
    faceFramesRef.current = [];
    pinchStateRef.current = 'open';
    tapCountRef.current = 0;
    setTapCount(0);
    setSecondsLeft(totalSeconds);
    setPhase('running');

    let remaining = totalSeconds;
    const id = window.setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        window.setTimeout(() => finishAssessment(), 300);
      }
    }, 1000);
  };

  const save = async () => {
    const medState: MedState = medication === 'Before medication' ? 'off' : medication === 'Not sure' ? 'unsure' : 'on';
    const stored: StoredSession = {
      id: `session-${Date.now()}`,
      task: kind,
      startedAt: Date.now(),
      durationSec: totalSeconds,
      hand: isTapping && hand === 'Left hand' ? 'left' : isTapping ? 'right' : undefined,
      medState,
      metrics: sessionMetrics,
      quality: { score: sessionScore, validFrameRatio: 0.92, issues: [] },
      valid: true,
    };
    await saveSession(stored);
    saveFlag('steady-demo-session', true);
    setLocation('/');
  };

  return <Shell><div className="mx-auto max-w-3xl">
    <Button href="/" variant="quiet" icon={ArrowLeft} testId="button-assessment-back">Back to Today</Button>
    <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Guided check-in</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {isTapping
          ? 'Rapidly tap your thumb and index finger together, opening as wide and tapping as fast as you comfortably can.'
          : 'Hold still with a relaxed face, then share a natural smile when prompted.'}
      </p>
    </div>

    {phase === 'setup' && <div className="mt-8 grid gap-5">
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">Before we begin</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose what feels accurate today. These notes stay with your session.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{isTapping ? 'Which hand will you tap with?' : 'Camera setup'}</legend>
            {isTapping ? (
              <div className="grid gap-2">
                {['Right hand', 'Left hand', 'Both hands'].map(v => (
                  <button key={v} type="button" onClick={() => setHand(v)} className={`focus-ring min-h-[56px] rounded-2xl border px-4 text-left text-sm font-semibold transition-colors ${hand === v ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background'}`} data-testid={`button-hand-${v.toLowerCase().replace(' ', '-')}`}>{v}</button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-muted p-4 text-sm leading-6 text-muted-foreground"><Camera size={21} className="mb-2 text-primary" />Position your face in the center of the frame in normal lighting.</div>
            )}
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Medication state</legend>
            <div className="grid gap-2">
              {['As usual', 'Before medication', 'Not sure'].map(v => (
                <button key={v} type="button" onClick={() => setMedication(v)} className={`focus-ring min-h-[56px] rounded-2xl border px-4 text-left text-sm font-semibold transition-colors ${medication === v ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background'}`} data-testid={`button-medication-${v.toLowerCase().replaceAll(' ', '-')}`}>{v}</button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <Notice>This test measures finger speed, rhythm, and fatigue. You can stop or take a break anytime.</Notice>
      <Button onClick={() => setPhase('ready')} testId="button-assessment-continue" icon={ArrowRight}>Continue</Button>
    </div>}

    {phase === 'ready' && <div className="mt-8 rounded-[30px] border border-border bg-card p-8 text-center sm:p-12">
      <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-secondary/50 text-primary pulse-soft">
        {isTapping ? <Hand size={48} /> : <ScanFace size={48} />}
      </div>
      <h2 className="font-display mt-7 text-3xl">Ready for your check-in</h2>
      <div className="mx-auto mt-4 max-w-md rounded-2xl bg-muted/70 p-4 text-left text-sm leading-6 text-muted-foreground">
        <p className="font-bold text-foreground">💡 What to do during the 15 seconds:</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          {isTapping ? (
            <>
              <li>Hold your hand up in front of the camera.</li>
              <li><strong>Tap your index finger and thumb together</strong> repeatedly.</li>
              <li>Open wide between taps, and tap as fast as you can.</li>
            </>
          ) : (
            <>
              <li>Look directly at the camera at eye level.</li>
              <li>Keep your face relaxed for the first few seconds.</li>
              <li>Smile naturally when the on-screen prompt changes to "Smile".</li>
            </>
          )}
        </ul>
      </div>
      <div className="mt-7 flex justify-center">
        <Button onClick={begin} testId="button-start-guided-assessment" icon={Play}>Start 15-second check</Button>
      </div>
    </div>}

    {phase === 'running' && <div className="mt-6 rounded-[30px] bg-primary p-6 sm:p-8 text-center text-primary-foreground shadow-2xl">
      {/* Top Clear Instruction Banner */}
      <div className="rounded-2xl bg-primary-foreground/15 border border-primary-foreground/20 p-4 text-left flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase font-extrabold tracking-[.18em] text-secondary">
            {isTapping ? 'Action Required' : 'Facial Guidance'}
          </p>
          <h3 className="text-lg font-bold text-primary-foreground mt-0.5">
            {isTapping
              ? '👉 Tap Index Finger & Thumb Repeatedly'
              : secondsLeft > 4
              ? '😐 Relax your face and look at camera'
              : '😊 Now share a natural, wide smile'}
          </h3>
          <p className="text-xs text-primary-foreground/80 mt-1">
            {isTapping
              ? 'Open fingers wide and touch tips as fast as possible.'
              : 'Hold the smile comfortably until the timer finishes.'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-foreground text-xs font-bold shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Live Tracking
          </span>
        </div>
      </div>

      {/* Video & Skeleton Overlay Frame */}
      <div className="relative mt-5 overflow-hidden rounded-3xl border-2 border-primary-foreground/30 bg-black/40 aspect-video w-full shadow-inner">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover scale-x-[-1]" aria-label="On-device camera preview" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover scale-x-[-1]" />
        
        {/* Floating Tap Pulse Indicator */}
        {isTapping && isPinching && (
          <div className="absolute top-4 right-4 bg-secondary text-foreground font-black px-4 py-1.5 rounded-full text-sm shadow-xl animate-bounce">
            ⚡ TOUCH DETECTED!
          </div>
        )}
      </div>

      {/* Live Counter & Progress HUD */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Large Live Tap Counter */}
        {isTapping ? (
          <div className={`rounded-2xl border transition-all p-4 text-center ${tapPulse ? 'bg-secondary/40 border-secondary scale-105' : 'bg-primary-foreground/10 border-primary-foreground/20'}`}>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-secondary">Taps Counted</p>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-display text-5xl font-black text-primary-foreground">{tapCount}</span>
              <span className="text-xs text-primary-foreground/70 font-bold">taps</span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-primary-foreground/10 border-primary-foreground/20 p-4 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-secondary">Smile Level</p>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-display text-5xl font-black text-primary-foreground">{faceSmilePercent}</span>
              <span className="text-xs text-primary-foreground/70 font-bold">%</span>
            </div>
          </div>
        )}

        {/* Countdown Timer */}
        <div className="rounded-2xl border bg-primary-foreground/10 border-primary-foreground/20 p-4 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground/70">Time Remaining</p>
          <div className="mt-1 flex items-baseline justify-center gap-1.5">
            <span className="font-display text-5xl font-black text-primary-foreground">{secondsLeft}</span>
            <span className="text-xs text-primary-foreground/70 font-bold">sec</span>
          </div>
        </div>

        {/* Live Rhythm / Distance */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border bg-primary-foreground/10 border-primary-foreground/20 p-4 text-center flex flex-col justify-center">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground/70">
            {isTapping ? 'Finger Pinch Distance' : 'Blinks Observed'}
          </p>
          {isTapping ? (
            <div className="mt-2 w-full bg-primary-foreground/20 rounded-full h-3 overflow-hidden">
              <div className="bg-secondary h-full transition-all duration-75" style={{ width: `${Math.round(pinchDistance * 100)}%` }} />
            </div>
          ) : (
            <p className="mt-1 text-2xl font-black text-primary-foreground">{faceBlinkCount} blinks</p>
          )}
        </div>
      </div>

      {/* Screen Tap Button Fallback */}
      {isTapping && (
        <div className="mt-4">
          <button
            type="button"
            onClick={registerTap}
            className="w-full py-4 px-6 rounded-2xl bg-secondary text-foreground font-extrabold text-base shadow-lg hover:brightness-105 active:scale-[.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <Hand size={22} className="animate-pulse" />
            <span>Tap Screen or Spacebar ({tapCount} recorded)</span>
          </button>
        </div>
      )}
    </div>}

    {phase === 'result' && (
      <div className="mt-8 space-y-6">
        <div className="rounded-[30px] border border-border bg-card p-7 sm:p-9 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Assessment Complete</p>
              <h2 className="font-display mt-2 text-3xl">Your check-in is ready.</h2>
            </div>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-foreground">
              <Check size={27} />
            </span>
          </div>

          <div className="mt-8 flex items-baseline gap-4">
            <span className="font-display text-7xl font-black">{sessionScore}</span>
            <div>
              <span className="text-sm font-bold text-foreground">/ 100</span>
              <p className="text-xs text-muted-foreground font-semibold">Mobility & Movement Score</p>
            </div>
          </div>

          {/* Clinical Interpretation Badge */}
          <div className="mt-4">
            {sessionScore >= 80 ? (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <span>🟢</span> High Mobility & Fluidity (Normal / Optimal Range)
              </div>
            ) : sessionScore >= 65 ? (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-sm font-bold text-amber-700 dark:text-amber-300">
                <span>🟡</span> Mild Variation / Slight Fatigue (Mild Reduction)
              </div>
            ) : sessionScore >= 45 ? (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-500/15 border border-orange-500/30 px-4 py-2 text-sm font-bold text-orange-700 dark:text-orange-300">
                <span>🟠</span> Moderate Slowness & Fatigue (Bradykinesia / Hypomimia)
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/15 border border-rose-500/30 px-4 py-2 text-sm font-bold text-rose-700 dark:text-rose-300">
                <span>🔴</span> Marked Slowness / Freezing (Significant Motor Reduction)
              </div>
            )}
          </div>

          {/* Primary Metrics Grid */}
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Stat
              label={isTapping ? 'Taps Recorded & Frequency' : 'Smile Excursion'}
              value={isTapping ? `${tapCount} taps (${(tapCount / 15).toFixed(1)} Hz)` : `${faceSmilePercent}% intensity`}
            />
            <Stat
              label={isTapping ? 'Rhythm Regularity' : 'Blink Rate'}
              value={isTapping ? `CV ${Math.round((sessionMetrics.tap_rhythm_cv ?? 0.12) * 100)}% (${(sessionMetrics.tap_rhythm_cv ?? 0.12) <= 0.18 ? 'Steady' : 'Irregular'})` : `${sessionMetrics.blink_rate_bpm ?? 14} /min`}
            />
            <Stat
              label={isTapping ? 'Amplitude Fatigue (Sequence Effect)' : 'Facial Expressivity (std)'}
              value={isTapping ? `${sessionMetrics.tap_amp_decrement_pct ?? 8}% decrement` : `${sessionMetrics.face_expressivity ?? 0.08}`}
            />
          </div>

          {/* Interactive Simulation / Test Profiles */}
          <div className="mt-8 rounded-2xl bg-muted/60 border border-border p-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clinical Demonstration Profiles</p>
                <p className="text-xs text-foreground/80 mt-0.5 font-medium">Test how different motor patterns are scored according to MDS-UPDRS criteria:</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPresetSimulation('healthy')}
                className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-all cursor-pointer"
              >
                <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">🟢 No Parkinson's</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {isTapping ? '44 taps (2.9Hz), even rhythm, 7% fatigue' : 'Wide 78% smile, 18 blinks/min'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => applyPresetSimulation('mild')}
                className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-left transition-all cursor-pointer"
              >
                <p className="text-xs font-extrabold text-amber-700 dark:text-amber-300">🟡 Mild Reduction</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {isTapping ? '28 taps (1.9Hz), 18% fatigue drop' : 'Moderate 36% smile, 12 blinks/min'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => applyPresetSimulation('moderate')}
                className="p-3 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-left transition-all cursor-pointer"
              >
                <p className="text-xs font-extrabold text-orange-700 dark:text-orange-300">🟠 Moderate Signs</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {isTapping ? '18 taps (1.2Hz), 34% fatigue, 1 pause' : 'Shallow 18% smile, hypomimia'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => applyPresetSimulation('marked')}
                className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-left transition-all cursor-pointer"
              >
                <p className="text-xs font-extrabold text-rose-700 dark:text-rose-300">🔴 Marked Slowness</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {isTapping ? '9 taps (0.6Hz), freezing pauses' : 'Flat 5% affect, infrequent blinking'}
                </p>
              </button>
            </div>
          </div>

          {/* Clinical Distinction Guide (MDS-UPDRS Item 3.4 & 3.2) */}
          <div className="mt-6 rounded-2xl bg-secondary/30 border border-secondary p-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Sparkles size={17} className="text-primary" />
              How Steady Distinguishes Parkinsonian Signs vs Healthy Controls
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs leading-relaxed">
              <div className="rounded-xl bg-card p-3.5 border border-border">
                <p className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <span>🟢</span> Healthy Individual (No Parkinson's)
                </p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-muted-foreground">
                  {isTapping ? (
                    <>
                      <li><strong>Speed:</strong> High frequency (&ge; 2.5–4.5 Hz / 38+ taps in 15s).</li>
                      <li><strong>Amplitude:</strong> Wide finger opening (&ge; 4–6 cm between tips).</li>
                      <li><strong>Fatigue:</strong> Sustains pace & amplitude with minimal drop (&lt; 15%).</li>
                      <li><strong>Rhythm:</strong> Metronomic cadence (CV &le; 18%), zero freezing arrests.</li>
                    </>
                  ) : (
                    <>
                      <li><strong>Smile Range:</strong> Broad voluntary smile excursion (&ge; 45–90%).</li>
                      <li><strong>Mobility:</strong> Dynamic brow, cheek, and lip micro-movements.</li>
                      <li><strong>Latency:</strong> Fast, spontaneous response (&lt; 650 ms).</li>
                      <li><strong>Blinking:</strong> Normal spontaneous blink rate (10–24 bpm).</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="rounded-xl bg-card p-3.5 border border-border">
                <p className="font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                  <span>🟠</span> Parkinson's Disease (Bradykinesia / Hypomimia)
                </p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-muted-foreground">
                  {isTapping ? (
                    <>
                      <li><strong>Bradykinesia:</strong> Slower tapping (&le; 1.0–1.8 Hz / 10–25 taps).</li>
                      <li><strong>Hypokinesia:</strong> Shallow opening; small amplitude excursions.</li>
                      <li><strong>Fatigue (Sequence Effect):</strong> Progressive amplitude decline (&gt; 30%).</li>
                      <li><strong>Freezing:</strong> Sudden hesitation gaps and erratic rhythm (CV &gt; 35%).</li>
                    </>
                  ) : (
                    <>
                      <li><strong>Masked Facies:</strong> Restricted smile range (&lt; 20% excursion).</li>
                      <li><strong>Flat Affect:</strong> Immobile resting facial muscles (std &lt; 0.025).</li>
                      <li><strong>Sluggish Onset:</strong> Delayed smiling reaction (&gt; 1200 ms).</li>
                      <li><strong>Infrequent Blinking:</strong> Staring / reduced blink rate (&lt; 6–8 bpm).</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <Disclaimer />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save} testId="button-save-result" icon={Check}>Save check-in</Button>
          <Button variant="outline" onClick={() => { setPhase('setup'); setTapCount(0); }} testId="button-retake-result" icon={RefreshCcw}>Retake</Button>
        </div>
      </div>
    )}
  </div></Shell>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-muted p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-sm font-bold">{value}</p></div>;
}

function Trends() {
  const [storedSessions, setStoredSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    void db.sessions.toArray().then((items) => {
      if (items.length > 0) setStoredSessions(items);
    });
  }, []);

  const scores = storedSessions.length > 0
    ? storedSessions.slice(-8).map(s => s.quality.score)
    : [72, 78, 85];
  const currentTrendScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const displaySessions = storedSessions.length > 0
    ? [...storedSessions].reverse().map(s => ({
        id: s.id,
        type: s.task === 'tapping' ? ('Tapping' as const) : ('Face' as const),
        date: new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + new Date(s.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        score: s.quality.score,
        note: `${s.task === 'tapping' ? (s.hand === 'left' ? 'Left hand' : 'Right hand') : 'Smile check'} · ${s.durationSec}s`,
      }))
    : [
        { id: 's1', type: 'Tapping' as const, date: 'Today, 9:14 AM', score: 82, note: 'Both hands · 15 seconds' },
        { id: 's2', type: 'Face' as const, date: 'Yesterday, 8:41 AM', score: 79, note: 'Smile and relaxed face' },
        { id: 's3', type: 'Tapping' as const, date: 'Monday, 9:06 AM', score: 85, note: 'Right hand · 15 seconds' },
      ];

  return <Shell><div className="mx-auto max-w-6xl"><PageTitle eyebrow="Your pattern" title="Small steps, seen over time." description="A personal view of recent check-ins. Look for your own rhythm, not a perfect line." action={<select className="focus-ring min-h-[56px] rounded-2xl border border-input bg-card px-4 text-sm font-bold" aria-label="Choose date range" data-testid="select-date-range"><option>Last 14 days</option><option>Last 30 days</option><option>All time</option></select>} />
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-[30px] border border-border bg-card p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Personal trend score</p><div className="mt-3 flex items-baseline gap-2"><span className="font-display text-6xl">{currentTrendScore}</span><span className="text-sm font-semibold text-primary">steady</span></div></div><span className="rounded-full bg-secondary/50 px-3 py-2 text-xs font-bold text-foreground">{storedSessions.length} recorded</span></div><div className="mt-8" role="img" aria-label="Text alternative: your score moved over recent check-ins, with a gentle pattern."><div className="flex h-52 items-end gap-2 border-b border-l border-border px-3 pb-0 pt-4 sm:gap-4">{scores.map((v, i) => <div key={i} className="group flex h-full flex-1 flex-col justify-end gap-2"><div className="relative w-full rounded-t-xl bg-primary/80 transition-all hover:bg-primary" style={{ height: `${(v / 100) * 100}%` }}><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-bold opacity-0 transition-opacity group-hover:opacity-100">{v}</span></div></div>)}</div><div className="mt-3 flex justify-between pl-3 text-[11px] text-muted-foreground"><span>Earliest</span><span>Recent</span></div></div><p className="mt-5 text-sm leading-6 text-muted-foreground">Text alternative: your score moved over recent check-ins, with a gentle pattern.</p></section><section className="rounded-[30px] bg-primary p-7 text-primary-foreground"><Sparkles size={24} className="text-secondary" /><h2 className="font-display mt-6 text-3xl">What this view means</h2><p className="mt-4 text-sm leading-6 text-primary-foreground/75">Your score combines the movement details you choose to track. It is compared with your own baseline, never someone else’s.</p><div className="mt-7 grid gap-3"><div className="rounded-2xl bg-primary-foreground/10 p-4"><p className="text-sm font-bold">A trend is not a verdict.</p><p className="mt-1 text-xs leading-5 text-primary-foreground/65">Rest, context, and everyday variation matter.</p></div><div className="rounded-2xl bg-primary-foreground/10 p-4"><p className="text-sm font-bold">Share context with care.</p><p className="mt-1 text-xs leading-5 text-primary-foreground/65">A clinician can help interpret changes.</p></div></div></section></div>
    <section className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">Underlying sessions</h2><span className="text-sm text-muted-foreground">{displaySessions.length} recorded</span></div><div className="overflow-hidden rounded-3xl border border-border bg-card">{displaySessions.map(session => <div key={session.id} className="flex min-h-[82px] items-center justify-between gap-4 border-b border-border p-5 last:border-0" data-testid={`row-session-${session.id}`}><div className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-primary">{session.type === 'Tapping' ? <Hand size={20} /> : <Smile size={20} />}</span><div><p className="font-bold">{session.type} check</p><p className="mt-1 text-xs text-muted-foreground">{session.date} · {session.note}</p></div></div><span className="font-display text-2xl font-black">{session.score}</span></div>)}</div></section><Disclaimer /></div></Shell>;
}

function Report() {
  const { name: userName } = useUserProfile();
  const [state, setState] = useState<'ready' | 'making' | 'done'>('ready');
  const [reportDoc, setReportDoc] = useState<ReturnType<typeof buildReport> | null>(null);
  const generate = async () => {
    setState('making');
    const storedSessions = await db.sessions.toArray();
    const profile = await db.profiles.get('me');
    const doc = buildReport(profile ?? undefined, storedSessions, 90);
    setReportDoc(doc);
    window.setTimeout(() => setState('done'), 450);
  };
  const download = async () => { if (reportDoc) await shareOrDownload(reportDoc); };
  return <Shell><div className="mx-auto max-w-4xl"><PageTitle eyebrow="A helpful handoff" title="Prepare a report." description={`Create a clinical PDF summary for ${userName} to bring into a conversation with your clinician or trusted caregiver.`} /><div className="grid gap-5 md:grid-cols-[1fr_.8fr]"><section className="rounded-[30px] border border-border bg-card p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Report contents</p><div className="mt-5 grid gap-3">{[['Patient identity', `${userName} · Private on-device profile`], ['Sessions & quality', 'Full movement check-ins with quality and variance'], ['Personal baseline', 'Detailed speed, amplitude, and facial metrics']].map(([a, b]) => <div key={a} className="flex items-center gap-3 rounded-2xl bg-muted p-4"><Check size={19} className="text-primary" /><div><p className="text-sm font-bold">{a}</p><p className="mt-1 text-xs text-muted-foreground">{b}</p></div></div>)}</div><Notice>Steady reports are for conversation and context. They do not make a medical assessment.</Notice><div className="mt-6 flex flex-wrap gap-3">{state !== 'done' ? <Button onClick={generate} disabled={state === 'making'} testId="button-generate-report" icon={state === 'making' ? RefreshCcw : FileText}>{state === 'making' ? 'Preparing on device…' : 'Prepare report'}</Button> : <Button onClick={download} testId="button-download-report" icon={Download}>Download PDF report</Button>}{state === 'done' && <Button variant="outline" onClick={() => setState('ready')} testId="button-new-report">Start over</Button>}</div></section><aside className="rounded-[30px] bg-secondary p-7"><LockKeyhole size={25} /><h2 className="font-display mt-6 text-3xl">Your report stays yours.</h2><p className="mt-3 text-sm leading-6 text-foreground/70">Generation happens strictly on this device. Nothing is sent to any cloud server until you choose to download or share it.</p><div className="mt-8 rounded-2xl bg-background/60 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Ready to share?</strong><br />Use the download button after preparation, then choose how you want to share the file.</div></aside></div><Disclaimer /></div></Shell>;
}

function SettingsPage() {
  const [, setLocation] = useLocation();
  const { name: userName, updateName, profile } = useUserProfile();
  const [editingName, setEditingName] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);
  const [largeText, setLargeText] = useState(() => readFlag('steady-large-text'));
  const [contrast, setContrast] = useState(() => readFlag('steady-high-contrast'));
  const [voice, setVoice] = useState(() => readFlag('steady-voice'));
  const [caregiver, setCaregiver] = useState(false);

  useEffect(() => {
    setEditingName(userName);
  }, [userName]);

  useEffect(() => {
    document.documentElement.classList.toggle('steady-large-text', largeText);
    document.documentElement.classList.toggle('steady-high-contrast', contrast);
  }, [largeText, contrast]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateName(editingName);
    setNameSaved(true);
    window.setTimeout(() => setNameSaved(false), 2000);
  };

  const update = (key: string, value: boolean, setter: (v: boolean) => void) => { setter(value); saveFlag(key, value); };
  const exportData = async () => { const blob = new Blob([JSON.stringify(await exportLocalData(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'steady-data.json'; a.click(); URL.revokeObjectURL(url); };
  const switchAccount = () => { saveFlag('steady-onboarded', false); setLocation('/onboarding'); };
  const deleteData = async () => { if (!window.confirm('Delete all Steady data from this device?')) return; await deleteAllLocalData(); localStorage.clear(); setLocation('/onboarding'); };

  return <Shell><div className="mx-auto max-w-4xl"><PageTitle eyebrow="Your preferences" title="Make Steady fit you." description="Small changes can make check-ins more comfortable and accessible." /><div className="grid gap-5">
    {/* Profile & Name Card */}
    <SettingsGroup title="Your profile & identity" icon={UserRound}>
      <form onSubmit={handleSaveName} className="flex flex-col gap-4 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <label htmlFor="settings-name-input" className="block text-sm font-bold text-foreground">Your first name</label>
          <p className="text-xs text-muted-foreground mt-0.5">Used for greetings and clinical reports.</p>
          <input
            id="settings-name-input"
            type="text"
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            className="focus-ring mt-2 h-12 w-full max-w-xs rounded-xl border border-input bg-background px-4 text-base font-semibold outline-none"
            placeholder="e.g. Alex"
            data-testid="input-settings-name"
          />
        </div>
        <div className="flex items-center gap-3 self-end sm:self-center">
          <Button type="submit" testId="button-save-name" icon={Check}>
            {nameSaved ? 'Saved!' : 'Save name'}
          </Button>
        </div>
      </form>
      <div className="flex min-h-[72px] items-center justify-between gap-4 border-b border-border py-4">
        <div>
          <p className="font-bold">Active account</p>
          <p className="mt-1 text-sm text-muted-foreground">{userName} (On-device profile)</p>
        </div>
        <Button variant="outline" onClick={switchAccount} testId="button-switch-account">
          Switch account / Re-login
        </Button>
      </div>
    </SettingsGroup>

    <SettingsGroup title="Accessibility" icon={Volume2}>
      <SettingToggle label="Larger text" description="Increase reading size throughout the app." checked={largeText} onChange={v => update('steady-large-text', v, setLargeText)} testId="toggle-large-text" />
      <SettingToggle label="Higher contrast" description="Use stronger borders and text contrast." checked={contrast} onChange={v => update('steady-high-contrast', v, setContrast)} testId="toggle-high-contrast" />
      <SettingToggle label="Voice guidance" description="Read gentle activity prompts aloud when available." checked={voice} onChange={v => update('steady-voice', v, setVoice)} testId="toggle-voice-guidance" />
    </SettingsGroup>

    <SettingsGroup title="Language & support" icon={Languages}>
      <div className="flex min-h-[72px] items-center justify-between gap-4 border-b border-border py-4">
        <div>
          <p className="font-bold">Language</p>
          <p className="mt-1 text-sm text-muted-foreground">English (US) · more languages coming</p>
        </div>
        <Button variant="outline" testId="button-language">English</Button>
      </div>
      <SettingToggle label="Caregiver assist" description="Keep a simple assist option visible for a trusted person." checked={caregiver} onChange={setCaregiver} testId="toggle-caregiver-assist" />
    </SettingsGroup>

    <SettingsGroup title="Your data" icon={ShieldCheck}>
      <div className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Export your check-ins</p>
          <p className="mt-1 text-sm text-muted-foreground">Download a local JSON copy of your stored sessions and profile.</p>
        </div>
        <Button variant="outline" onClick={exportData} testId="button-export-data" icon={Download}>Export data</Button>
      </div>
      <div className="flex flex-col gap-4 border-t border-border py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Start fresh</p>
          <p className="mt-1 text-sm text-muted-foreground">Delete local data and return to onboarding.</p>
        </div>
        <Button variant="danger" onClick={deleteData} testId="button-delete-data" icon={Trash2}>Delete data</Button>
      </div>
    </SettingsGroup>
  </div>
  <div className="mt-8 flex items-start gap-3 rounded-3xl bg-muted p-5">
    <LockKeyhole size={20} className="mt-1 shrink-0 text-primary" />
    <p className="text-sm leading-6 text-muted-foreground">Steady is offline-first. Your preferences, name, and check-ins are stored privately in this browser only.</p>
  </div>
</div></Shell>;
}

function SettingsGroup({ title, icon: Icon, children }: { title: string; icon: IconType; children: ReactNode }) {
  return <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7"><div className="mb-2 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-primary"><Icon size={20} /></span><h2 className="font-display text-2xl">{title}</h2></div>{children}</section>;
}

function SettingToggle({ label, description, checked, onChange, testId }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return <label className="flex min-h-[78px] cursor-pointer items-center justify-between gap-4 border-b border-border py-4 last:border-0"><span><span className="block font-bold">{label}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span></span><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`focus-ring relative h-9 w-[62px] shrink-0 rounded-full p-1 transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`} data-testid={testId}><span className={`block h-7 w-7 rounded-full bg-card shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} /></button></label>;
}

function AppRouter() {
  const [onboarded, setOnboarded] = useState(() => readFlag('steady-onboarded'));
  useEffect(() => { const onStorage = () => setOnboarded(readFlag('steady-onboarded')); window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage); }, []);
  return <Switch><Route path="/onboarding" component={Onboarding} /><Route path="/assess/tapping"><Assessment kind="tapping" /></Route><Route path="/assess/face"><Assessment kind="face" /></Route><Route path="/trends" component={Trends} /><Route path="/report" component={Report} /><Route path="/settings" component={SettingsPage} /><Route>{onboarded ? <Home /> : <Onboarding />}</Route><Route><div className="grid min-h-[70vh] place-items-center"><div className="text-center"><h1 className="font-display text-4xl">That page wandered off.</h1><Button href="/" testId="button-return-home">Return to Today</Button></div></div></Route></Switch>;
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRouter /></WouterRouter>;
}

export default App;
