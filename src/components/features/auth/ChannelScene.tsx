"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { animate as tween } from "motion";
import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  type Camera,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";

// Story: WhatsApp, Instagram and Messenger stream messages into the AI core; every few messages
// the core hands a "hot lead" (gold) to your team.
const CHANNELS = [
  { color: "#25d366", tilt: [0.35, 0, 0.25], speed: 0.22, phase: 0 },
  { color: "#e1306c", tilt: [-0.3, 0, -0.35], speed: -0.17, phase: 2.1 },
  { color: "#0084ff", tilt: [0.9, 0, 0.1], speed: 0.13, phase: 4.2 },
] as const;
const AI = new Color("#d98fd7");
const GOLD = new Color("#f5b544");
const R = 2.4; // channel orbit radius
const TEAM = new Vector3(3.1, 1.45, -0.6);
const PER = 5; // messages in flight per channel
const TRAIL = 10; // points per comet
const LEAD = 14; // points in the hot-lead comet
const HALOS = 2 + CHANNELS.length + 1; // core halo, nucleus, channels, team
const NUCLEUS = new Color("#ffe3fb");
const SHELL = 420; // particles on the core's neural shell
const GYROS = [
  { r: 1.3, color: "#d98fd7" },
  { r: 1.48, color: "#9c369a" },
  { r: 1.64, color: "#e9c3e8" },
] as const;
const MSG0 = HALOS;
const LEAD0 = MSG0 + CHANNELS.length * PER * TRAIL;
const GLOW = LEAD0 + LEAD;
const STARS = 900;
const RINGS = 6;
const FOV = 40;
const CAM_Z = 7.2; // closest the camera gets; narrow panels pull it back so the system fits
const TAN = Math.tan((FOV * Math.PI) / 360);
const HALF_W = 3.9; // world half-width the camera keeps in view (team node + orbits)

// Soft additive sprites (halos, comets, stars); size in world units, so they scale with depth.
const glowShader = {
  vertexShader: /* glsl */ `
    uniform float uScale;
    attribute float aSize;
    attribute float aAlpha;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uScale / -mv.z;
      vColor = aColor;
      vAlpha = aAlpha;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      gl_FragColor = vec4(vColor, pow(max(1.0 - d, 0.0), 2.0) * vAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

// The AI core: a glass orb that only glows at its rim (additive, so the centre stays clear and
// messages can be seen flying in), with faint energy bands sweeping across it.
const coreShader = {
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vP;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      vP = position;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uRim;
    uniform vec3 uMid;
    uniform float uFlash;
    uniform float uTime;
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vP;
    void main() {
      float fres = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
      float rim = pow(fres, 3.0);
      float bands = 0.5 + 0.5 * sin(vP.y * 16.0 - uTime * 1.8);
      vec3 col = mix(uMid, uRim, rim) * (rim * 1.5 + fres * 0.12 * bands + uFlash * 0.35);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

function glowGeometry(n: number) {
  return new BufferGeometry()
    .setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3))
    .setAttribute("aColor", new BufferAttribute(new Float32Array(n * 3), 3))
    .setAttribute("aSize", new BufferAttribute(new Float32Array(n), 1))
    .setAttribute("aAlpha", new BufferAttribute(new Float32Array(n), 1));
}
const glowMaterial = () =>
  new ShaderMaterial({
    ...glowShader,
    uniforms: { uScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

// Quadratic bezier a -> b (control) -> c, written into out.
function bez(out: Vector3, a: Vector3, b: Vector3, c: Vector3, t: number) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}

function createSim() {
  const circle = new Float32Array(128 * 3);
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    circle.set([Math.cos(a) * R, 0, Math.sin(a) * R], i * 3);
  }
  const starGeo = glowGeometry(STARS);
  const sp = starGeo.getAttribute("position") as BufferAttribute;
  const sc = starGeo.getAttribute("aColor") as BufferAttribute;
  const sz = starGeo.getAttribute("aSize") as BufferAttribute;
  const sa = starGeo.getAttribute("aAlpha") as BufferAttribute;
  const tint = new Color();
  for (let i = 0; i < STARS; i++) {
    sp.setXYZ(i, (Math.random() - 0.5) * 32, (Math.random() - 0.5) * 26, -2 - Math.random() * 12);
    tint.set("#ffffff").lerp(AI, Math.random() * 0.7);
    sc.setXYZ(i, tint.r, tint.g, tint.b);
    sz.setX(i, 0.03 + Math.random() * 0.07);
    sa.setX(i, 0.25 + Math.random() * 0.6);
  }
  // Neural shell: evenly spread points (Fibonacci sphere) just outside the glass.
  const shellGeo = glowGeometry(SHELL);
  for (let i = 0; i < SHELL; i++) {
    const y = 1 - (2 * (i + 0.5)) / SHELL;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    (shellGeo.getAttribute("position") as BufferAttribute).setXYZ(
      i,
      Math.cos(a) * r * 1.08,
      y * 1.08,
      Math.sin(a) * r * 1.08,
    );
    tint.set("#ffffff").lerp(AI, 0.3 + Math.random() * 0.6);
    (shellGeo.getAttribute("aColor") as BufferAttribute).setXYZ(i, tint.r, tint.g, tint.b);
    (shellGeo.getAttribute("aSize") as BufferAttribute).setX(i, 0.035 + Math.random() * 0.035);
    (shellGeo.getAttribute("aAlpha") as BufferAttribute).setX(i, 0.35 + Math.random() * 0.5);
  }
  return {
    shellGeo,
    orbitGeo: new BufferGeometry().setAttribute("position", new BufferAttribute(circle, 3)),
    starGeo,
    starMat: glowMaterial(),
    glowGeo: glowGeometry(GLOW),
    glowMat: glowMaterial(),
    coreMat: new ShaderMaterial({
      ...coreShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uMid: { value: new Color("#9c369a") },
        uRim: { value: AI.clone() },
      },
    }),
    tilt: CHANNELS.map((c) => new Quaternion().setFromEuler(new Euler(...c.tilt))),
    colors: CHANNELS.map((c) => new Color(c.color)),
    pos: CHANNELS.map(() => new Vector3()),
    ctrl: CHANNELS.map(() => new Vector3()),
    leadCtrl: TEAM.clone()
      .multiplyScalar(0.5)
      .add(new Vector3(0, 1.2, 0.5)),
    teamPos: TEAM.clone(),
    prev: new Float32Array(CHANNELS.length * PER).fill(-1),
    pulse: CHANNELS.map(() => 0),
    ringAge: new Array<number>(RINGS).fill(9),
    nextRing: 0,
    flash: 0,
    teamPulse: 0,
    arrivals: 0,
    t: 0, // own clock: pausing doesn't make everything jump on resume
    lead: -1,
    leadHit: false,
    ORIGIN: new Vector3(),
    UP: new Vector3(0, 1, 0),
    p: new Vector3(),
    c: new Color(),
  };
}

type Sim = ReturnType<typeof createSim>;
type View = {
  camera: Camera;
  pointer: { x: number; y: number };
  zoom: number;
  aspect: number;
  uScale: number;
  stars: Group | null;
  shell: Group | null;
  gyros: (Mesh | null)[];
  core: Mesh | null;
  team: Mesh | null;
  nodes: (Mesh | null)[];
  rings: (Mesh | null)[];
};

function spawnRing(s: Sim, rings: (Mesh | null)[]) {
  const i = s.nextRing++ % RINGS;
  s.ringAge[i] = 0;
  rings[i]?.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
}

// One simulation step, outside React: mutates the three.js objects and the sim state in place.
// dt is capped by the caller, so a tab switch doesn't cause a giant jump.
function tick(s: Sim, dt: number, v: View) {
  const { camera } = v;
  const t = (s.t += dt);
  const ease = Math.min(1, dt * 3);

  // Camera: distance fits the panel's width (Motion fly-in multiplies it), damped pointer parallax,
  // and it aims below the core so the system sits in the upper part while the text owns the bottom.
  const z = Math.max(CAM_Z, HALF_W / (TAN * v.aspect)) * v.zoom;
  camera.position.x += (v.pointer.x * 0.06 * z - camera.position.x) * ease;
  camera.position.y += ((0.12 - v.pointer.y * 0.05) * z - camera.position.y) * ease;
  camera.position.z = z;
  camera.lookAt(0.2, -z * TAN * 0.42, 0);

  s.glowMat.uniforms.uScale.value = v.uScale;
  s.starMat.uniforms.uScale.value = v.uScale;
  if (v.stars) v.stars.rotation.y = t * 0.015;

  const gp = s.glowGeo.getAttribute("position") as BufferAttribute;
  const gc = s.glowGeo.getAttribute("aColor") as BufferAttribute;
  const gs = s.glowGeo.getAttribute("aSize") as BufferAttribute;
  const ga = s.glowGeo.getAttribute("aAlpha") as BufferAttribute;
  const put = (i: number, p: Vector3, col: Color, size: number, alpha: number) => {
    gp.setXYZ(i, p.x, p.y, p.z);
    gc.setXYZ(i, col.r, col.g, col.b);
    gs.setX(i, size);
    ga.setX(i, alpha);
  };

  // Channels ride their own tilted orbits.
  CHANNELS.forEach((ch, c) => {
    const a = ch.phase + t * ch.speed;
    const node = s.pos[c].set(Math.cos(a) * R, 0, Math.sin(a) * R).applyQuaternion(s.tilt[c]);
    // Control point swirls the path sideways and up, so messages arc into the core.
    s.ctrl[c]
      .copy(node)
      .cross(s.UP)
      .normalize()
      .multiplyScalar(0.9)
      .addScaledVector(node, 0.45)
      .add(s.p.set(0, 0.4, 0));
    s.pulse[c] = Math.max(0, s.pulse[c] - dt * 2.5);
    const m = v.nodes[c];
    if (m) {
      m.position.copy(node);
      m.scale.setScalar(1 + s.pulse[c] * 0.6);
    }
    put(2 + c, node, s.colors[c], 1.3 + s.pulse[c] * 0.8, 0.5 + s.pulse[c] * 0.4);

    // Message comets: head + fading trail, tinting from channel colour to AI colour as absorbed.
    for (let i = 0; i < PER; i++) {
      const j = c * PER + i;
      const f = (t * (0.24 + c * 0.03) + i / PER) % 1;
      if (s.prev[j] >= 0 && f < s.prev[j]) {
        // Arrived: core flashes, a shockwave goes out, and the channel sends the next one.
        s.flash = Math.min(1, s.flash + 0.5);
        s.pulse[c] = 1;
        spawnRing(s, v.rings);
        if (++s.arrivals % 4 === 0 && s.lead < 0) {
          s.lead = 0;
          s.leadHit = false;
        }
      }
      s.prev[j] = f;
      for (let k = 0; k < TRAIL; k++) {
        const q = f - k * 0.022;
        const fall = 1 - k / TRAIL;
        const e = q * q * 0.6 + q * 0.4; // accelerates into the core
        bez(s.p, node, s.ctrl[c], s.ORIGIN, Math.max(e, 0));
        s.c.copy(s.colors[c]).lerp(AI, e * e * e);
        put(
          MSG0 + j * TRAIL + k,
          s.p,
          s.c,
          0.24 * Math.pow(fall, 0.8),
          q < 0 ? 0 : 0.95 * fall * fall,
        );
      }
    }
  });

  // Hot lead: gold comet from the core out to the team node.
  s.teamPos.copy(TEAM).setY(TEAM.y + Math.sin(t * 1.3) * 0.08);
  if (s.lead >= 0) s.lead += dt / 1.4;
  for (let k = 0; k < LEAD; k++) {
    const q = s.lead - k * 0.035;
    const fall = 1 - k / LEAD;
    bez(s.p, s.ORIGIN, s.leadCtrl, s.teamPos, Math.min(Math.max(q, 0), 1));
    put(LEAD0 + k, s.p, GOLD, 0.3 * fall, s.lead < 0 || q < 0 || q > 1 ? 0 : fall);
  }
  if (s.lead >= 1 && !s.leadHit) {
    s.leadHit = true;
    s.teamPulse = 1;
  }
  if (s.lead - (LEAD - 1) * 0.035 > 1) s.lead = -1;
  s.teamPulse = Math.max(0, s.teamPulse - dt * 1.5);
  if (v.team) {
    v.team.position.copy(s.teamPos);
    v.team.rotation.set(t * 0.6, t * 0.9, 0);
    v.team.scale.setScalar(1 + s.teamPulse * 0.7);
  }
  put(HALOS - 1, s.teamPos, GOLD, 1.5 + s.teamPulse * 1.5, 0.45 + s.teamPulse * 0.5);

  // Core + its halo.
  s.flash = Math.max(0, s.flash - dt * 1.8);
  s.coreMat.uniforms.uTime.value = t;
  s.coreMat.uniforms.uFlash.value = s.flash;
  if (v.core) {
    v.core.rotation.y += dt * 0.2;
    v.core.scale.setScalar(1 + s.flash * 0.08);
  }
  put(0, s.ORIGIN, AI, 4.4 + s.flash * 1.4, 0.2 + s.flash * 0.3);
  put(1, s.ORIGIN, NUCLEUS, 0.9 + Math.sin(t * 3) * 0.08 + s.flash * 0.7, 0.95);
  if (v.shell) {
    v.shell.rotation.set(t * 0.05, t * 0.12, 0);
    v.shell.scale.setScalar(1 + Math.sin(t * 1.6) * 0.02 + s.flash * 0.06);
  }
  // Gyroscope rings, each spinning on its own axis.
  v.gyros[0]?.rotation.set(t * 0.5, 0.3, 0);
  v.gyros[1]?.rotation.set(1.2, t * 0.4, 0.4);
  v.gyros[2]?.rotation.set(0.6, -0.5, t * 0.35);

  // Shockwave rings expand and fade.
  v.rings.forEach((ring, i) => {
    if (!ring) return;
    s.ringAge[i] += dt;
    const life = Math.min(s.ringAge[i] / 1.4, 1);
    ring.scale.setScalar(0.9 + life * 2.6);
    (ring.material as MeshBasicMaterial).opacity = 0.5 * (1 - life) * (1 - life);
  });

  for (const a of [gp, gc, gs, ga]) a.needsUpdate = true;
}

function Scene({ intro }: { intro: boolean }) {
  const { gl, size } = useThree();
  const core = useRef<Mesh>(null);
  const team = useRef<Mesh>(null);
  const stars = useRef<Group>(null);
  const shell = useRef<Group>(null);
  const gyros = useRef<(Mesh | null)[]>([]);
  const nodes = useRef<(Mesh | null)[]>([]);
  const rings = useRef<(Mesh | null)[]>([]);
  const pointer = useRef({ x: 0, y: 0 });
  const zoom = useRef(intro ? 1.9 : 1);

  // All per-frame state lives here: no allocations or React state in the frame loop.
  const [s] = useState(createSim);

  useEffect(
    () => () => {
      [s.orbitGeo, s.starGeo, s.shellGeo, s.glowGeo, s.starMat, s.glowMat, s.coreMat].forEach((o) =>
        o.dispose(),
      );
    },
    [s],
  );

  // Motion drives the camera fly-in (spring), so the scene arrives with the login form.
  useEffect(() => {
    if (!intro) return;
    const c = tween(1.9, 1, {
      type: "spring",
      stiffness: 35,
      damping: 14,
      onUpdate: (v) => (zoom.current = v),
    });
    return () => c.stop();
  }, [intro]);

  // Content sits over the canvas, so listen on the window; pointermove covers mouse, pen and touch.
  useEffect(() => {
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const move = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      pointer.current = {
        x: clamp(((e.clientX - r.left) / r.width) * 2 - 1),
        y: clamp(((e.clientY - r.top) / r.height) * 2 - 1),
      };
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, [gl]);

  useFrame(({ camera }, dt) =>
    tick(s, Math.min(dt, 0.05), {
      camera,
      pointer: pointer.current,
      zoom: zoom.current,
      aspect: size.width / size.height,
      uScale: (size.height * gl.getPixelRatio()) / (2 * TAN),
      stars: stars.current,
      shell: shell.current,
      gyros: gyros.current,
      core: core.current,
      team: team.current,
      nodes: nodes.current,
      rings: rings.current,
    }),
  );

  return (
    <>
      <group ref={stars}>
        <points geometry={s.starGeo} material={s.starMat} frustumCulled={false} />
      </group>

      <mesh ref={core} material={s.coreMat}>
        <icosahedronGeometry args={[0.95, 24]} />
      </mesh>
      <group ref={shell}>
        <points geometry={s.shellGeo} material={s.starMat} frustumCulled={false} />
      </group>
      {GYROS.map((g, i) => (
        <mesh
          key={g.r}
          ref={(m) => {
            gyros.current[i] = m;
          }}
        >
          <torusGeometry args={[g.r, 0.007, 8, 160]} />
          <meshBasicMaterial
            color={g.color}
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {CHANNELS.map((ch, c) => (
        <group key={ch.color} quaternion={s.tilt[c]}>
          <lineLoop geometry={s.orbitGeo}>
            <lineBasicMaterial color={ch.color} transparent opacity={0.22} depthWrite={false} />
          </lineLoop>
        </group>
      ))}
      {CHANNELS.map((ch, c) => (
        <mesh
          key={ch.color}
          ref={(m) => {
            nodes.current[c] = m;
          }}
        >
          <sphereGeometry args={[0.16, 24, 16]} />
          <meshBasicMaterial color={ch.color} />
        </mesh>
      ))}

      <mesh ref={team}>
        <octahedronGeometry args={[0.2]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>

      {Array.from({ length: RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            rings.current[i] = m;
          }}
        >
          <ringGeometry args={[0.96, 1, 96]} />
          <meshBasicMaterial
            color={AI}
            transparent
            opacity={0}
            side={DoubleSide}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      <points geometry={s.glowGeo} material={s.glowMat} frustumCulled={false} />
    </>
  );
}

// intro: Motion camera fly-in (off under reduced motion). playing=false holds a still frame.
export default function ChannelScene({ intro, playing }: { intro: boolean; playing: boolean }) {
  return (
    <Canvas
      frameloop={playing ? "always" : "demand"}
      dpr={[1, 1.5]}
      flat
      camera={{ position: [0, 0.9, CAM_Z], fov: FOV }}
      gl={{ alpha: true, antialias: true }}
    >
      <Scene intro={intro} />
    </Canvas>
  );
}
