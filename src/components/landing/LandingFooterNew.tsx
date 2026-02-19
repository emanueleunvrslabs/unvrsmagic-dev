import { Link } from "react-router-dom";
import logo from "@/assets/logo-unvrs.png";

export function LandingFooterNew() {
  return (
    <footer className="py-16 bg-black relative" role="contentinfo" aria-label="Footer">
      {/* Top border with glass effect */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="container mx-auto px-6">
        {/* Liquid Glass Container */}
        <div 
          className="rounded-3xl p-8 md:p-12 mb-12"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 0 rgba(255,255,255,0.1)",
          }}
        >
          <div className="grid md:grid-cols-4 gap-12">
            {/* Logo & Description */}
            <div>
              <img 
                src={logo}
                alt="UNVRS LABS" 
                className="h-14 w-auto mb-4"
              />
              <p className="text-white font-semibold text-lg mb-3" style={{ fontFamily: "Orbitron, sans-serif" }}>
                UNVRS LABS
              </p>
              <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: "Orbitron, sans-serif" }}>
                Coding the Universe, One Pixel at a Time
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-semibold mb-6 text-sm tracking-wider" style={{ fontFamily: "Orbitron, sans-serif" }}>
                QUICK LINKS
              </h3>
              <div className="flex flex-col gap-3">
                {[
                  { name: "Home", href: "#home" },
                  { name: "Services", href: "#services" },
                  { name: "Magic AI", href: "#works" },
                  { name: "Foundations", href: "#foundations" },
                  { name: "Contact", href: "#contact" },
                ].map((item) => (
                  <a 
                    key={item.name}
                    href={item.href} 
                    className="text-white/60 hover:text-white transition-colors text-sm"
                    style={{ fontFamily: "Orbitron, sans-serif" }}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-white font-semibold mb-6 text-sm tracking-wider" style={{ fontFamily: "Orbitron, sans-serif" }}>
                GET IN TOUCH
              </h3>
              <div className="flex flex-col gap-3">
                <a href="mailto:emanuele@unvrslabs.dev" className="text-white/60 hover:text-white transition-colors text-sm" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  emanuele@unvrslabs.dev
                </a>
                <Link 
                  to="/auth" 
                  className="liquid-glass-pill inline-block w-fit text-white/80 hover:text-white text-xs"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  Client Portal
                </Link>
              </div>
            </div>

            {/* Download App */}
            <div>
              <h3 className="text-white font-semibold mb-6 text-sm tracking-wider" style={{ fontFamily: "Orbitron, sans-serif" }}>
                DOWNLOAD APP
              </h3>
              <a 
                href="#" 
                className="inline-block transition-transform hover:scale-105"
                aria-label="Download on App Store"
              >
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div>
                    <p className="text-white/60 text-[10px] leading-none" style={{ fontFamily: "Orbitron, sans-serif" }}>
                      Download on the
                    </p>
                    <p className="text-white font-semibold text-sm" style={{ fontFamily: "Orbitron, sans-serif" }}>
                      App Store
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-xs" style={{ fontFamily: "Orbitron, sans-serif" }}>
            © {new Date().getFullYear()} UNVRS LABS. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="text-white/40 hover:text-white/70 transition-colors text-xs" style={{ fontFamily: "Orbitron, sans-serif" }}>
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" className="text-white/40 hover:text-white/70 transition-colors text-xs" style={{ fontFamily: "Orbitron, sans-serif" }}>
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}