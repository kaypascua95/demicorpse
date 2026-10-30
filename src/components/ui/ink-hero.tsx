import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SiteLink } from '@/lib/navigation';

// Adapted from the supplied InkHero concept. One ScrollTrigger controls the
// image's WebGL ink threshold, the headline, and the editorial calls to action.
// No global Lenis instance, second header, or continuous animation loop.
const VERTEX = [
  '#version 300 es',
  'in vec2 aPosition;',
  'out vec2 vUv;',
  'void main() { vUv = (aPosition + 1.0) * 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }',
].join('\n');

const FRAGMENT = [
  '#version 300 es',
  'precision highp float;',
  'in vec2 vUv;',
  'out vec4 outColor;',
  'uniform sampler2D uImage;',
  'uniform vec2 uCover;',
  'uniform float uAspect;',
  'uniform float uProgress;',
  'uniform vec2 uPointer;',
  'uniform float uPointerRadius;',
  'float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
  'float noise(vec2 p) {',
  '  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
  '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);',
  '}',
  'float fbm(vec2 p) {',
  '  float v = 0.0; float a = 0.5;',
  '  for (int i = 0; i < 5; i++) { v += noise(p) * a; p = p * 2.07 + 9.13; a *= 0.5; }',
  '  return v;',
  '}',
  'void main() {',
  '  vec2 uv = vUv;',
  '  vec2 crop = 0.5 + (uv - 0.5) * uCover;',
  '  vec3 src = texture(uImage, crop).rgb;',
  '  float luminosity = dot(src, vec3(0.299, 0.587, 0.114));',
  '  vec3 monochrome = vec3(pow(luminosity, 1.07)) * vec3(0.93, 0.91, 0.86);',
  '  float pattern = fbm(uv * vec2(uAspect, 1.0) * 5.0);',
  '  pattern += (noise(uv * vec2(uAspect, 1.0) * 43.0) - 0.5) * 0.12;',
  '  float d = distance((uv - uPointer) * vec2(uAspect, 1.0), vec2(0.0));',
  '  float localReveal = uPointerRadius > 0.0 ? exp(-d*d/(uPointerRadius*uPointerRadius)) * 0.2 : 0.0;',
  '  float threshold = mix(-0.12, 1.15, clamp(uProgress + localReveal, 0.0, 1.0));',
  '  float reveal = 1.0 - smoothstep(threshold - 0.055, threshold + 0.055, pattern);',
  '  if (uProgress > 0.995) reveal = 1.0;',
  '  float border = 1.0 - smoothstep(0.0, 0.023, abs(pattern - threshold));',
  '  monochrome = mix(monochrome, vec3(0.12, 0.10, 0.09), border * 0.31 * (1.0-uProgress));',
  '  outColor = vec4(monochrome * reveal, reveal);',
  '}',
].join('\n');

interface InkHeroProps {
  imageSrc: string;
  imageAlt: string;
  onRevealChange?: (revealed: boolean) => void;
}

export default function InkHero({ imageSrc, imageAlt, onRevealChange }: InkHeroProps) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [restart, setRestart] = useState(0);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const element = root.current;
    const surface = stage.current;
    const target = canvas.current;
    if (!element || !surface || !target) return;

    gsap.registerPlugin(ScrollTrigger);
    let current = reduced ? 1 : 0;
    let developed = reduced ? 1 : 0;
    let lastHeaderVisible: boolean | null = null;
    let pointer: [number, number] = [-100, -100];
    let pointerRadius = 0;
    let image: HTMLImageElement | null = null;
    let live = true;
    const gl = target.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    let program: WebGLProgram | null = null;
    let shader1: WebGLShader | null = null;
    let shader2: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let texture: WebGLTexture | null = null;
    let shaderReady = false;
    let trigger: ScrollTrigger | null = null;

    const compile = (kind: number, source: string): WebGLShader | null => {
      if (!gl) return null;
      const shader = gl.createShader(kind);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    if (gl) {
      shader1 = compile(gl.VERTEX_SHADER, VERTEX);
      shader2 = compile(gl.FRAGMENT_SHADER, FRAGMENT);
      if (shader1 && shader2) {
        program = gl.createProgram();
        if (program) {
          gl.attachShader(program, shader1);
          gl.attachShader(program, shader2);
          gl.linkProgram(program);
          if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.useProgram(program);
            buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
            const location = gl.getAttribLocation(program, 'aPosition');
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
            texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);
            shaderReady = !!texture;
          }
        }
      }
    }

    const draw = () => {
      if (!live || !gl || !shaderReady || !program || !image || gl.isContextLost()) return;
      const width = Math.max(1, Math.round(surface.clientWidth * Math.min(devicePixelRatio || 1, 1.5)));
      const height = Math.max(1, Math.round(surface.clientHeight * Math.min(devicePixelRatio || 1, 1.5)));
      if (target.width !== width || target.height !== height) {
        target.width = width; target.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      const canvasAspect = width / height;
      const imageAspect = image.naturalWidth / image.naturalHeight;
      const coverX = canvasAspect > imageAspect ? 1 : canvasAspect / imageAspect;
      const coverY = canvasAspect > imageAspect ? imageAspect / canvasAspect : 1;
      gl.uniform2f(gl.getUniformLocation(program, 'uCover'), coverX, coverY);
      gl.uniform1f(gl.getUniformLocation(program, 'uAspect'), canvasAspect);
      gl.uniform1f(gl.getUniformLocation(program, 'uProgress'), developed);
      gl.uniform2f(gl.getUniformLocation(program, 'uPointer'), pointer[0], pointer[1]);
      gl.uniform1f(gl.getUniformLocation(program, 'uPointerRadius'), pointerRadius);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const paint = (value: number) => {
      current = reduced ? 1 : clamp(value);
      // A genuinely empty opening gives way to ink, then to text and navigation.
      developed = clamp((current - .12) / .72);
      const copy = clamp((current - .52) / .20);
      const actions = clamp((current - .72) / .16);
      const cue = 1 - clamp((current - .02) / .19);
      element.style.setProperty('--ink-progress', String(developed));
      element.style.setProperty('--ink-scrim', String(clamp((current - .34) / .43)));
      element.style.setProperty('--ink-copy', String(copy));
      element.style.setProperty('--ink-cta', String(actions));
      element.style.setProperty('--ink-cue', String(cue));
      element.dataset.inkStation = current < .22 ? 'paper' : current < .72 ? 'wash' : 'print';
      const showHeader = reduced || current >= .74;
      if (showHeader !== lastHeaderVisible) {
        lastHeaderVisible = showHeader;
        onRevealChange?.(showHeader);
      }
      draw();
    };

    const onLost = (event: Event) => {
      event.preventDefault();
      shaderReady = false;
      if (live) setReady(false);
    };
    const onRestored = () => { if (live) setRestart(value => value + 1); };
    target.addEventListener('webglcontextlost', onLost);
    target.addEventListener('webglcontextrestored', onRestored);

    if (gl && shaderReady && texture) {
      const nextImage = new Image();
      nextImage.crossOrigin = 'anonymous';
      nextImage.decoding = 'async';
      nextImage.onload = () => {
        if (!live || !gl || !texture || !program || gl.isContextLost()) return;
        try {
          image = nextImage;
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextImage);
          paint(current);
          setReady(true);
        } catch {
          image = null;
          setReady(false);
        }
      };
      nextImage.onerror = () => { if (live) setReady(false); };
      nextImage.src = imageSrc;
    } else {
      setReady(false);
    }

    const onResize = () => draw();
    const observer = new ResizeObserver(onResize);
    observer.observe(surface);
    const onMove = (event: PointerEvent) => {
      if (reduced || current < .12 || !window.matchMedia('(pointer: fine)').matches) return;
      const r = surface.getBoundingClientRect();
      pointer = [(event.clientX - r.left) / r.width, 1 - (event.clientY - r.top) / r.height];
      pointerRadius = 0.14;
      draw();
    };
    const onLeave = () => { pointerRadius = 0; draw(); };
    surface.addEventListener('pointermove', onMove, { passive: true });
    surface.addEventListener('pointerleave', onLeave, { passive: true });

    paint(reduced ? 1 : 0);
    if (!reduced) {
      trigger = ScrollTrigger.create({
        trigger: element,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => paint(self.progress),
        onRefresh: self => paint(self.progress),
      });
    }

    return () => {
      live = false;
      trigger?.kill();
      observer.disconnect();
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerleave', onLeave);
      target.removeEventListener('webglcontextlost', onLost);
      target.removeEventListener('webglcontextrestored', onRestored);
      if (gl) {
        if (texture) gl.deleteTexture(texture);
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (shader1) gl.deleteShader(shader1);
        if (shader2) gl.deleteShader(shader2);
      }
    };
  }, [imageSrc, onRevealChange, reduced, restart]);

  const scrollToReveal = () => {
    const element = root.current;
    const surface = stage.current;
    if (!element || !surface) return;
    const start = window.scrollY + element.getBoundingClientRect().top;
    const travel = Math.max(0, element.offsetHeight - surface.offsetHeight);
    window.scrollTo({ top: start + travel * .9, behavior: 'smooth' });
  };

  return <section
    ref={root}
    className="unmaking-ink-hero"
    data-ink-hero=""
    data-ink-station="paper"
    data-reduced-motion={String(reduced)}
    style={{ height: reduced ? '100svh' : '225svh' }}
  >
    <div ref={stage} className="unmaking-hero-stage">
      <div className="unmaking-hero-paper" aria-hidden="true" />
      <img
        className="unmaking-hero-fallback"
        src={imageSrc}
        alt={imageAlt}
        loading="eager"
        fetchPriority="high"
        style={{ opacity: ready ? 0 : undefined }}
      />
      <canvas ref={canvas} aria-hidden="true" className="unmaking-hero-canvas" style={{ opacity: ready ? 1 : 0 }} />
      <div className="unmaking-hero-scrim" aria-hidden="true" />
      {!reduced && <button type="button" className="unmaking-scroll-cue" onClick={scrollToReveal} aria-label="Scroll to reveal The Unmaking">
        <span className="unmaking-cue-caption">SCROLL TO REVEAL</span>
        <span className="unmaking-cue-line" aria-hidden="true" />
        <span className="unmaking-cue-circle" aria-hidden="true"><span /></span>
      </button>}
      <div className="unmaking-hero-image-caption">A place once familiar. A memory in revision.</div>

      <div className="unmaking-hero-copy">
        <h1><span>THE</span><span>UNMAKING</span></h1>
        <p className="unmaking-hero-byline">a novella by DemiCorpse</p>
        <div className="unmaking-hero-rule" aria-hidden="true" />
        <p className="unmaking-hero-summary">
          After her mother's death, Anna returns to a house full of ordinary things
          that no longer feel ordinary.
        </p>
        <div className="unmaking-hero-actions">
          <SiteLink className="unmaking-button-primary" href="/the-unmaking/chapter-01">Begin Reading <span aria-hidden="true">↗</span></SiteLink>
          <a className="unmaking-button-secondary" href="#unmaking-contents">Chapter Index <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="unmaking-hero-foot">
        <span>AN ORIGINAL NOVELLA</span>
        <span>THE UNMAKING <span aria-hidden="true">✦</span> DEMICORPSE</span>
        <span>01 — 06</span>
      </div>
    </div>
  </section>;
}
