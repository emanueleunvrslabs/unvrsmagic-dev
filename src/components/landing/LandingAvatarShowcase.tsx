import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import avatarVideo from "@/assets/avatar-video.mp4";

export function LandingAvatarShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="py-16 bg-black relative overflow-hidden flex flex-col items-center justify-center"
    >
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ width: 600, height: 600, background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{ width: 300, height: 300, background: "radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative flex flex-col items-center"
      >
        {/* Video container — black background needed for multiply blend mode */}
        <div
          className="relative w-[260px] sm:w-[340px] md:w-[420px] mx-auto"
          style={{ aspectRatio: "9/16", background: "#000000" }}
        >
          {/* Glow beneath feet */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full blur-2xl"
            style={{ width: "70%", height: 60, background: "rgba(168,85,247,0.25)" }}
          />

          {/* multiply renders white bg as transparent on black container */}
          <video
            src={avatarVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain relative z-10"
            style={{
              mixBlendMode: "multiply",
              filter: "contrast(1.15) saturate(1.2)",
            }}
          />
        </div>

        {/* Caption */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-4 text-center"
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
