import React, { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; vx: number; vy: number; radius: number; phase: number };

export const LandingParticleNetwork: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = window.matchMedia('(max-width: 768px)').matches;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let animationFrame = 0;
    let lastFrame = 0;
    const glowSprite = document.createElement('canvas');
    glowSprite.width = 32;
    glowSprite.height = 32;
    const glowContext = glowSprite.getContext('2d');
    if (glowContext) {
      const gradient = glowContext.createRadialGradient(16, 16, 0, 16, 16, 15);
      gradient.addColorStop(0, 'rgba(255, 246, 238, .95)');
      gradient.addColorStop(0.18, 'rgba(255, 122, 61, .58)');
      gradient.addColorStop(1, 'rgba(255, 77, 77, 0)');
      glowContext.fillStyle = gradient;
      glowContext.fillRect(0, 0, 32, 32);
    }

    const createParticles = () => {
      const count = compact ? 10 : Math.min(22, Math.max(14, Math.round(width / 65)));
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: reduceMotion
          ? (Math.random() > 0.5 ? 0.025 : -0.025)
          : (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.32),
        vy: reduceMotion
          ? (Math.random() > 0.5 ? 0.018 : -0.018)
          : (Math.random() > 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.2),
        radius: 0.9 + Math.random() * 1.4,
        phase: index * 0.63 + Math.random() * Math.PI
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      createParticles();
    };

    const draw = (time: number) => {
      animationFrame = window.requestAnimationFrame(draw);
      if (document.hidden || reduceMotion) {
        lastFrame = time;
        return;
      }
      // Cap at ~30 FPS to keep CPU/GPU usage minimal while preserving smooth ambient motion
      const elapsed = time - lastFrame;
      if (elapsed < 33) return;
      const frameDelta = lastFrame ? Math.min(2.2, elapsed / (1000 / 60)) : 1;
      lastFrame = time;
      context.clearRect(0, 0, width, height);

      const connectionDistance = compact ? 95 : 125;
      const connectionDistanceSq = connectionDistance * connectionDistance;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        particle.x += (particle.vx + Math.sin(time * 0.00055 + particle.phase) * 0.08) * frameDelta;
        particle.y += (particle.vy + Math.cos(time * 0.00042 + particle.phase) * 0.06) * frameDelta;
        if (particle.x < -20) particle.x = width + 20;
        if (particle.x > width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = height + 20;
        if (particle.y > height + 20) particle.y = -20;

        for (let targetIndex = index + 1; targetIndex < particles.length; targetIndex += 1) {
          const target = particles[targetIndex];
          const dx = particle.x - target.x;
          const dy = particle.y - target.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > connectionDistanceSq) continue;
          const opacity = (1 - Math.sqrt(distanceSquared) / connectionDistance) * 0.16;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(target.x, target.y);
          context.strokeStyle = `rgba(255, 122, 61, ${opacity})`;
          context.lineWidth = 0.65;
          context.stroke();
        }

        context.drawImage(glowSprite, particle.x - 16, particle.y - 16, 32, 32);
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    if (!reduceMotion) {
      animationFrame = window.requestAnimationFrame(draw);
    }
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" aria-hidden="true" />;
};
