"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { Icon } from "@/components/ui";
import styles from "./LoginScene.module.scss";

// Three.js loads on demand, so it never blocks the login form.
const ChannelScene = dynamic(() => import("./ChannelScene"), { ssr: false });

const LEGEND = [
  ["WhatsApp", "#25d366"],
  ["Instagram", "#e1306c"],
  ["Messenger", "#0084ff"],
  ["AI agent", "#d98fd7"],
  ["Your team", "#f5b544"],
] as const;
const item: Variants = {
  hidden: { opacity: 0, y: -8 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

function hasWebGL() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // free the probe context
    return !!gl;
  } catch {
    return false;
  }
}

// Full-bleed 3D backdrop for the auth showcase panel, on /login only: Meta channels -> AI agent ->
// your team. The panel's own text stays real HTML on top; a scrim keeps it readable.
export function LoginScene() {
  const isLogin = usePathname() === "/login";
  const reduce = useReducedMotion();
  const [gl, setGl] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    // shortcut: checked once; the panel is display:none below 1024px, so don't run WebGL there.
    // Upgrade to a matchMedia listener if resizing across the breakpoint matters.
    const id = requestAnimationFrame(() =>
      setGl(matchMedia("(min-width: 1024px)").matches && hasWebGL()),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  if (!isLogin || gl === false) return null;

  return (
    <motion.div
      data-login-scene
      className={styles.stage}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.1 }}
    >
      <div aria-hidden className={styles.canvas}>
        {gl && <ChannelScene intro={!reduce} playing={!reduce && playing} />}
      </div>
      <div aria-hidden className={styles.scrim} />

      <div className={styles.hud}>
        <motion.ul
          aria-hidden
          className={styles.legend}
          initial={reduce ? false : "hidden"}
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.8 } } }}
        >
          {LEGEND.map(([label, color], i) => (
            <motion.li key={label} className={styles.item} variants={item}>
              {i > 0 && <span className={styles.arrow}>{i < 3 ? "·" : "→"}</span>}
              <span className={styles.dot} style={{ background: color, color }} />
              {label}
            </motion.li>
          ))}
        </motion.ul>

        {/* WCAG 2.2.2: motion that runs longer than 5s gets a pause control. */}
        {gl && !reduce && (
          <motion.button
            type="button"
            className={styles.toggle}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause background animation" : "Play background animation"}
            title={playing ? "Pause animation" : "Play animation"}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <Icon name={playing ? "pause" : "play"} size={16} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
