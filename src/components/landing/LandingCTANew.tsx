import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function LandingCTANew() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="contact" ref={ref} className="py-32 bg-black relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl animate-float" style={{ animationDelay: "2s" }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="liquid-glass-card max-w-4xl mx-auto p-12 md:p-16 hover:bg-white/[0.06] transition-colors duration-300">
          <div className="relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              <h2
                className="text-4xl md:text-6xl font-bold text-white/90 mb-6"
                style={{ fontFamily: "Orbitron, sans-serif" }}
              >
                Ready to Build
                <br />
                <span className="text-white/90">
                  Your Universe?
                </span>
              </h2>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-white/70 text-lg mb-10 max-w-2xl mx-auto"
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              Let's collaborate to create innovative solutions that drive your business forward.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Link
                to="/auth"
                className="liquid-glass-btn inline-flex items-center gap-3 px-10 py-4 text-white font-semibold tracking-wider group"
                style={{ fontFamily: "Orbitron, sans-serif" }}
              >
                <Sparkles size={20} className="group-hover:rotate-12 transition-transform duration-300" />
                <span>GET STARTED</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}