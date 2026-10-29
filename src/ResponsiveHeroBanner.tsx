import { ArrowRight, Menu, X } from 'lucide-react';
import { BrandSymbol } from './Branding';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import LiquidMetalHero from './components/ui/liquid-metal-hero';

export default function ResponsiveHeroBanner() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const handleHeroPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--hero-pointer-x', `${x * 22}px`);
    event.currentTarget.style.setProperty('--hero-pointer-y', `${y * 18}px`);
  };
  const resetHeroPointer = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.removeProperty('--hero-pointer-x');
    event.currentTarget.style.removeProperty('--hero-pointer-y');
  };
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [mobileMenuOpen]);
  return (
    <section className="responsive-hero" onPointerMove={handleHeroPointerMove} onPointerLeave={resetHeroPointer}>
      <header className="responsive-hero-header">
        <Link to="/" className="brand responsive-hero-brand" aria-label="SkillBridge home">
          <span className="brand-icon"><BrandSymbol size={20} /></span>
          <span>skill<span className="brand-light">bridge</span></span>
        </Link>
        <nav className="responsive-hero-nav" aria-label="Main navigation">
          <Link to="/" className="active">Home</Link>
          <Link to="/about">About us</Link>
          <Link to="/opportunities">Opportunities</Link>
          <Link to="/our-story">Our story</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/contact">Contact us</Link>
          <Link to="/login">Log in</Link>
          <Link to="/register" className="responsive-nav-cta">Get started <ArrowRight size={15} /></Link>
        </nav>
        <button className="responsive-menu-toggle" aria-label="Open menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}>
          <Menu size={21} />
        </button>
      </header>
      {mobileMenuOpen && createPortal(<div className="responsive-mobile-menu" role="dialog" aria-modal="true" aria-label="Main menu">
        <div className="responsive-mobile-menu-head">
          <Link to="/" className="brand responsive-hero-brand" aria-label="SkillBridge home" onClick={() => setMobileMenuOpen(false)}>
            <span className="brand-icon"><BrandSymbol size={20} /></span>
            <span>skill<span className="brand-light">bridge</span></span>
          </Link>
          <button className="responsive-menu-close" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}><X size={23} /></button>
        </div>
        <nav className="responsive-mobile-nav" aria-label="Mobile navigation">
          <Link to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <Link to="/about" onClick={() => setMobileMenuOpen(false)}>About us</Link>
          <Link to="/opportunities" onClick={() => setMobileMenuOpen(false)}>Opportunities</Link>
          <Link to="/our-story" onClick={() => setMobileMenuOpen(false)}>Our story</Link>
          <Link to="/blog" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
          <Link to="/contact" onClick={() => setMobileMenuOpen(false)}>Contact us</Link>
          <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
          <Link to="/register" className="responsive-nav-cta" onClick={() => setMobileMenuOpen(false)}>Get started <ArrowRight size={17} /></Link>
        </nav>
      </div>, document.body)}
      <LiquidMetalHero
        badge="A clearer path to your next opportunity"
        title="Bridge your skills with your future."
        subtitle="Turn what you’re learning into real opportunities. Build your profile, see your progress, and connect with employers who value your skills."
        primaryCtaLabel="Get started"
        secondaryCtaLabel="Explore opportunities"
        onPrimaryCtaClick={() => navigate('/register')}
        onSecondaryCtaClick={() => navigate('/opportunities')}
        features={['Resume-led learning', 'Measured skill growth', 'Next-step opportunities']}
      />
    </section>
  );
}

function useTypedText(text: string, speed = 42) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);
  return shown;
}

function useLoopingDemoValue(initial: number, min: number, max: number, cycleMs = 10_000, duration = 1_800) {
  const [value, setValue] = useState(initial);
  const valueRef = useRef(initial);
  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const animate = () => {
      const startValue = valueRef.current;
      let target = Math.floor(Math.random() * (max - min + 1)) + min;
      if (target === Math.round(startValue)) target = target === max ? min : target + 1;
      let startTime = 0;
      const tick = (time: number) => {
        if (!startTime) startTime = time;
        const progress = Math.min(1, (time - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const nextValue = Math.round(startValue + (target - startValue) * eased);
        valueRef.current = nextValue;
        setValue(nextValue);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else timer = window.setTimeout(animate, Math.max(0, cycleMs - duration));
      };
      frame = requestAnimationFrame(tick);
    };
    timer = window.setTimeout(animate, 250);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [cycleMs, duration, max, min]);
  return value;
}

function SkillLine({ label, target, color }: { label: string; target: number; color: string }) {
  const value = useLoopingDemoValue(target, 40, 95);
  return <div className="skill-line"><div><span>{label}</span><b>{value}%</b></div><div className="bar"><i className={color} style={{ width: `${value}%` }} /></div></div>;
}

export function GrowthOverview() {
  const readiness = useLoopingDemoValue(72, 55, 92);
  const headline = useTypedText('Keep building');
  return <section className="growth-preview-section"><div className="container"><div className="responsive-hero-card">
    <div className="preview-top"><div><span className="overline">YOUR GROWTH OVERVIEW</span><h3>Skills in motion</h3></div><span className="live-tag"><i /> DEMO PREVIEW</span></div>
    <div className="preview-score"><div className="score-ring" style={{ borderColor: 'transparent', background: `linear-gradient(#faf9fc,#faf9fc) padding-box, conic-gradient(#7035df ${readiness * 3.6}deg, #e6def6 0deg) border-box` }}><b>{readiness}</b><small>readiness</small></div><div><b>{headline}</b><p>Your next step is within reach.</p><div className="mini-progress"><i style={{ width: `${readiness}%` }} /></div></div></div>
    <div className="skill-lines"><SkillLine label="Frontend development" target={82} color="purple" /><SkillLine label="Data fundamentals" target={64} color="blue" /><SkillLine label="Communication" target={55} color="amber" /></div>
    <div className="preview-bottom"><span><span className="target-mark">◎</span> Next recommended step</span><b>Practice a React assessment <ArrowRight size={14} /></b></div>
  </div></div></section>;
}
