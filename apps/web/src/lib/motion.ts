/*
 * Minimal spring + gesture primitives.
 *
 * Deliberately hand-rolled rather than pulling in a animation library: the app needs
 * exactly one gesture-driven surface (the mobile sheet), and this keeps the bundle flat.
 *
 * The two parameters are Apple's, not the physics triplet:
 *   bounce   — 0 is critically damped (no overshoot); ~0.2 gives a little give.
 *   response — roughly how long it takes to reach the target, in seconds.
 */

import { useCallback, useEffect, useRef } from 'react';

export interface SpringOptions { bounce?: number; response?: number }

/** Apple's momentum projection (exponential decay), not the v²/2a textbook form. */
export function project(velocity: number, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/** Progressive resistance past a boundary — real things slow before they stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A spring you can re-target mid-flight. It always starts from the *current*
 * on-screen value and carries the existing velocity through a re-target, which is
 * what stops a reversal feeling like a brick wall.
 */
export class Spring {
  value: number;
  velocity = 0;
  private target: number;
  private frame = 0;
  private last = 0;
  private stiffness = 0;
  private damping = 0;

  constructor(initial: number, private onChange: (v: number) => void, options: SpringOptions = {}) {
    this.value = initial;
    this.target = initial;
    this.configure(options);
  }

  configure({ bounce = 0, response = 0.35 }: SpringOptions) {
    const omega = (2 * Math.PI) / response;
    this.stiffness = omega * omega;
    // bounce 0 -> damping ratio 1 (critical). Higher bounce -> less damping.
    this.damping = 2 * omega * (1 - Math.min(Math.max(bounce, 0), 0.9));
  }

  /** Re-target without resetting position or velocity. */
  to(target: number, options?: SpringOptions & { velocity?: number }) {
    if (options) this.configure(options);
    if (options?.velocity !== undefined) this.velocity = options.velocity;
    this.target = target;
    if (prefersReducedMotion()) { this.stop(); this.set(target); return; }
    if (!this.frame) { this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
  }

  /** Jump to a value with no animation — used for 1:1 drag tracking. */
  set(value: number) { this.value = value; this.onChange(value); }

  stop() { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.velocity = 0; }

  private tick = (now: number) => {
    // Clamp dt so a backgrounded tab doesn't explode the integration.
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
    this.onChange(this.value);
    if (Math.abs(this.value - this.target) < 0.1 && Math.abs(this.velocity) < 0.1) {
      this.frame = 0;
      this.set(this.target);
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
}

/**
 * Drag-to-dismiss for the mobile sheet.
 *
 * Tracks the pointer 1:1 from wherever it was grabbed, resists upward past the top
 * edge, and on release decides by projected momentum — not by release position — so a
 * fast flick throws the sheet away even from near the top.
 */
export function useSheetDrag(onDismiss: () => void) {
  const ref = useRef<HTMLElement | null>(null);
  const spring = useRef<Spring | null>(null);
  const history = useRef<{ y: number; t: number }[]>([]);
  const startY = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    spring.current = new Spring(0, v => { el.style.transform = `translate3d(0, ${v}px, 0)`; });
    // Enter along the same path it will leave by: up from the bottom edge.
    if (!prefersReducedMotion()) {
      spring.current.set(el.getBoundingClientRect().height || 400);
      spring.current.to(0, { bounce: 0.12, response: 0.4 });
    }
    return () => spring.current?.stop();
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    // Only start a drag from the grabber or a non-scrolled body, so the sheet's own
    // scrolling still works.
    const scroller = el.scrollTop;
    const fromGrabber = (e.target as HTMLElement).closest('.sheet-grabber');
    if (!fromGrabber && scroller > 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    spring.current?.stop();
    dragging.current = true;
    // Respect where they grabbed it, measured against the live transform.
    startY.current = e.clientY - (spring.current?.value ?? 0);
    history.current = [{ y: e.clientY, t: performance.now() }];
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !spring.current || !ref.current) return;
    let next = e.clientY - startY.current;
    // Past the top edge, resist instead of stopping dead.
    if (next < 0) next = -rubberband(-next, ref.current.getBoundingClientRect().height);
    spring.current.set(next);
    history.current.push({ y: e.clientY, t: performance.now() });
    if (history.current.length > 6) history.current.shift();
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current || !spring.current || !ref.current) return;
    dragging.current = false;
    const samples = history.current;
    const first = samples[0], last = samples[samples.length - 1];
    const dt = last && first ? (last.t - first.t) / 1000 : 0;
    const velocity = dt > 0 ? (last.y - first.y) / dt : 0;

    const height = ref.current.getBoundingClientRect().height;
    // Decide from where the gesture is *going*, then hand the velocity to the spring.
    const projected = spring.current.value + project(velocity);
    if (projected > height / 2) {
      spring.current.to(height, { bounce: 0, response: 0.3, velocity });
      setTimeout(onDismiss, 220);
    } else {
      spring.current.to(0, { bounce: 0.2, response: 0.35, velocity });
    }
  }, [onDismiss]);

  return { ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
