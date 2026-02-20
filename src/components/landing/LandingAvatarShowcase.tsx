import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import avatarVideo from "@/assets/avatar-video.mp4";

export function LandingAvatarShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 bg-black relative overflow-hidden flex flex-col items-center justify-center">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-2xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative flex flex-col items-center"
      >
        {/* Avatar video — background removed via mix-blend-mode */}
        <div className="relative w-[260px] sm:w-[340px] md:w-[420px] aspect-[9/16] mx-auto">
          {/* Subtle radial glow beneath avatar */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-purple-500/20 blur-2xl rounded-full" />

          <video
            src={avatarVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{
              mixBlendMode: "screen",
              filter: "contrast(1.05) brightness(1.1)",
            }}
          />
        </div>

        {/* Caption */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-6 text-center"
        >
          <p
            className="text-white/40 text-xs tracking-[0.3em] uppercase"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            Powered by UNVRS AI
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
