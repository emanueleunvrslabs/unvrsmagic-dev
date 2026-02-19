import { ArrowUpRight, Sparkles, Video, Image } from "lucide-react";

export function LandingWorksNew() {
  return (
    <section id="works" className="py-32 bg-black relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6">
        <div className="mb-16">
          <p
            className="text-white/60 text-sm mb-4 tracking-wider"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            Our Solutions
          </p>
          <h2
            className="text-5xl md:text-7xl font-bold text-white"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            Magic AI
          </h2>
        </div>

        {/* Single showcase card */}
        <div className="liquid-glass-card liquid-glass-interactive liquid-glass-specular overflow-hidden group max-w-4xl mx-auto">
          {/* Hero visual area */}
          <div className="relative aspect-[16/9] md:aspect-[16/7] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-fuchsia-500/20 to-cyan-500/20" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 md:gap-4 p-5 md:p-8 text-center">
              <div className="liquid-glass-pill px-3 py-1.5 md:px-4 md:py-2 flex items-center gap-2">
                <Sparkles size={14} className="text-purple-400" />
                <span className="text-[10px] md:text-xs text-white/80" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  Powered by AI
                </span>
              </div>
              <h3
                className="text-xl sm:text-3xl md:text-5xl font-bold text-white leading-tight"
                style={{ fontFamily: "Orbitron, sans-serif" }}
              >
                Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">stunning visuals</span>
                <br />with AI magic
              </h3>
              <p
                className="text-white/60 text-xs md:text-base max-w-lg hidden sm:block"
                style={{ fontFamily: "Orbitron, sans-serif" }}
              >
                Generate breathtaking images and videos using the world's most advanced AI models. From concept to creation in seconds.
              </p>
            </div>
          </div>

          {/* Features + CTA */}
          <div className="p-4 md:p-8 flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-6">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Image size={14} className="text-purple-400" />
                </div>
                <span className="text-white/70 text-xs md:text-sm" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  Image Generation
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Video size={14} className="text-cyan-400" />
                </div>
                <span className="text-white/70 text-xs md:text-sm" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  Video Generation
                </span>
              </div>
            </div>

            <a
              href="https://magicai.unvrslabs.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-glass-pill flex items-center gap-2 px-6 py-3 text-white hover:bg-white/10 transition-all group/btn w-full md:w-auto justify-center"
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              <span className="text-sm font-medium">Try Magic AI</span>
              <ArrowUpRight size={16} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
