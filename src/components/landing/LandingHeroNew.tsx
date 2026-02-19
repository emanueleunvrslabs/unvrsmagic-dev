import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

const words = ["UNVRS", "LABS"];

interface ShinyTextProps {
  text: string;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ShinyText = ({ text, speed = 3, className = "", style }: ShinyTextProps) => {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        ...style,
        backgroundImage: `linear-gradient(
          120deg,
          rgba(255, 255, 255, 0.5) 40%,
          rgba(255, 255, 255, 1) 50%,
          rgba(255, 255, 255, 0.5) 60%
        )`,
        backgroundSize: "200% 100%",
        animation: `shiny-text ${speed}s linear infinite`,
        WebkitBackgroundClip: "text",
      }}
    >
      {text}
    </span>
  );
};

export function LandingHeroNew() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentWord = words[currentIndex];
  const letters = currentWord.split("");

  return (
    <>
      <style>{`
        @keyframes shiny-text {
          0% {
            background-position: 100% 50%;
          }
          100% {
            background-position: -100% 50%;
          }
        }
      `}</style>
      <section id="home" className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden pt-24" aria-label="Hero">
        {/* Black background */}
        <div className="absolute inset-0 bg-black" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col items-center gap-12">
            {/* Title - Centered */}
            <div className="text-center">
              <div>
                {/* Hidden H1 for SEO — the visual title is animated spans */}
                <h1 className="sr-only">UNVRS LABS — AI Integration, Custom Software & Digital Solutions</h1>
                <p
                  className="text-white/60 text-sm mb-4 tracking-widest"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  WELCOME TO
                </p>

                <div className="relative h-[140px] md:h-[200px] mb-6 flex items-center justify-center">
                  <div 
                    className="relative inline-flex justify-center items-center"
                    style={{ fontFamily: "Orbitron, sans-serif" }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentIndex}
                        className="flex"
                      >
                        {letters.map((letter, index) => (
                          <div key={index} className="relative inline-block overflow-y-hidden px-1">
                            <motion.span
                              initial={{ y: "100%" }}
                              animate={{ y: "0%" }}
                              exit={{ y: "-100%" }}
                              transition={{ 
                                duration: 0.5, 
                                delay: index * 0.06,
                                ease: [0.43, 0.13, 0.23, 0.96]
                              }}
                              className="inline-block text-[60px] md:text-[100px] lg:text-[140px] font-bold tracking-tighter leading-none"
                              style={{ 
                                fontFamily: "Orbitron, sans-serif",
                                background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.15) 100%)",
                                WebkitBackgroundClip: "text",
                                backgroundClip: "text",
                                color: "transparent",
                                WebkitTextStroke: "1px rgba(255,255,255,0.1)",
                                filter: "drop-shadow(0 0 20px rgba(255,255,255,0.2)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
                              }}
                            >
                              {letter}
                            </motion.span>
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <ShinyText 
                  text="Coding the Universe, One Pixel at a Time"
                  speed={3}
                  className="text-lg md:text-xl max-w-md mx-auto leading-relaxed"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                />
              </div>
            </div>

            {/* Scroll indicator */}
            <a
              href="#learn-more"
              className="flex flex-col items-center cursor-pointer group mt-8"
            >
              <div className="liquid-glass-pill p-2 animate-bounce">
                <ChevronDown size={20} className="text-white/70" />
              </div>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
