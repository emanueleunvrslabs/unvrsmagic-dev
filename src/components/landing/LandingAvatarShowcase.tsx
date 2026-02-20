import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Sparkles } from "lucide-react";
import avatarVideo from "@/assets/avatar-video.mp4";

export function LandingAvatarShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="py-20 bg-black relative overflow-hidden flex flex-col items-center justify-center"
    >
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ width: 700, height: 700, background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{ width: 350, height: 350, background: "radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative flex flex-col items-center px-6 w-full max-w-sm mx-auto"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30"
          style={{
            background: "rgba(168,85,247,0.1)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Sparkles size={14} className="text-purple-400" />
          <span
            className="text-xs text-white/70"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            AI Avatar
          </span>
        </motion.div>

        {/* Glass card with video */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="w-full rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 24px 80px rgba(168,85,247,0.2), 0 0 0 1px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <div className="w-2 h-2 rounded-full bg-red-400/70" />
            <div className="w-2 h-2 rounded-full bg-yellow-400/70" />
            <div className="w-2 h-2 rounded-full bg-green-400/70" />
            <span
              className="ml-2 text-xs text-white/30 tracking-widest"
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              UNVRS AI · LIVE
            </span>
            {/* Pulsing live dot */}
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-400/80" style={{ fontFamily: "Orbitron, sans-serif" }}>LIVE</span>
            </span>
          </div>

          {/* Video */}
          <video
            src={avatarVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full object-cover"
            style={{ display: "block" }}
          />

          {/* Bottom bar */}
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
            <span
              className="text-xs text-white/40"
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              Powered by UNVRS AI
            </span>
            <span className="text-xs text-purple-400/80" style={{ fontFamily: "Orbitron, sans-serif" }}>
              ✦ Interactive
            </span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
