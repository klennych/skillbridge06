import { LiquidMetal, liquidMetalPresets } from '@paper-design/shaders-react';
import { motion, useReducedMotion } from 'framer-motion';

interface LiquidMetalHeroProps {
  badge?: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  onPrimaryCtaClick: () => void;
  onSecondaryCtaClick?: () => void;
  features?: string[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.2, staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const buttonVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function LiquidMetalHero({
  badge,
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  onPrimaryCtaClick,
  onSecondaryCtaClick,
  features = [],
}: LiquidMetalHeroProps) {
  const reducedMotion = useReducedMotion();
  return (
    <section className="liquid-metal-hero" id="home" aria-label="SkillBridge introduction">
      <div className="liquid-metal-surface" aria-hidden="true">
        <LiquidMetal
          {...liquidMetalPresets[2].params}
          colorBack="#777b82"
          colorTint="#e5eef8"
          shiftRed={0}
          shiftBlue={0}
          distortion={0.065}
          speed={reducedMotion ? 0 : 0.22}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </div>
      <div className="liquid-metal-shade" aria-hidden="true" />
      <div className="liquid-metal-grain" aria-hidden="true" />
      <div className="container liquid-metal-content">
        <motion.div
          className="liquid-metal-copy"
          variants={containerVariants}
          initial={reducedMotion ? false : 'hidden'}
          animate="visible"
        >
          {badge && <motion.div className="liquid-metal-badge-row" variants={itemVariants}><span className="liquid-metal-badge">{badge}</span></motion.div>}
          <motion.div className="liquid-metal-heading-group" variants={itemVariants}>
            <motion.h1 role="heading" aria-level={1} variants={itemVariants}>{title}</motion.h1>
            <motion.p variants={itemVariants}>{subtitle}</motion.p>
          </motion.div>
          <motion.div className="liquid-metal-actions" variants={buttonVariants}>
            <motion.button type="button" className="responsive-hero-primary" onClick={onPrimaryCtaClick} whileHover={{ scale: 1.045 }} whileTap={{ scale: 0.96 }}>
              {primaryCtaLabel}
            </motion.button>
            {secondaryCtaLabel && onSecondaryCtaClick && (
              <motion.button type="button" className="responsive-hero-secondary" onClick={onSecondaryCtaClick} whileHover={{ scale: 1.045 }} whileTap={{ scale: 0.96 }}>
                {secondaryCtaLabel}
              </motion.button>
            )}
          </motion.div>
          {features.length > 0 && (
            <motion.div className="liquid-metal-feature-card" variants={itemVariants}>
              <div className="liquid-metal-feature-grid">
                {features.map(feature => <span key={feature}><span className="liquid-metal-feature-check" aria-hidden="true">✓</span>{feature}</span>)}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
