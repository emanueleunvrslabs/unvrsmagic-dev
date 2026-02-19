import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LandingNavProps {
  showBack?: boolean;
  backTo?: string;
}

export function LandingNav({ showBack = false, backTo }: LandingNavProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const navItems = [
    { label: "HOME", href: "#home", sectionId: "home" },
    { label: "SERVICES", href: "#services", sectionId: "services" },
    { label: "MAGIC AI", href: "#works", sectionId: "works" },
    { label: "FOUNDATIONS", href: "#foundations", sectionId: "foundations" },
    { label: "CONTACT", href: "https://wa.me/34625976744", external: true },
    { label: "LOGIN", href: "/auth", isRoute: true },
  ];

  // Scroll spy - track which section is in view
  useEffect(() => {
    const sectionIds = navItems
      .filter(item => item.sectionId)
      .map(item => item.sectionId!);

    const handleScroll = () => {
      // If at top of page, set HOME as active
      if (window.scrollY < 100) {
        setActiveIndex(0);
        return;
      }

      // Find which section is currently in view
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const element = document.getElementById(sectionIds[i]);
        if (element) {
          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          // Section is considered active if its top is in the upper 50% of viewport
          if (rect.top <= viewportHeight * 0.5) {
            const index = navItems.findIndex(item => item.sectionId === sectionIds[i]);
            if (index !== -1) {
              setActiveIndex(index);
              return;
            }
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Determine which index to show indicator for (hover takes priority over active)
  const displayIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;

  // Update indicator position
  useEffect(() => {
    if (displayIndex !== null && itemRefs.current[displayIndex] && navRef.current) {
      const item = itemRefs.current[displayIndex];
      const nav = navRef.current;
      if (item) {
        const itemRect = item.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        setIndicatorStyle({
          left: itemRect.left - navRect.left,
          width: itemRect.width,
        });
      }
    }
  }, [displayIndex]);

  return (
    <nav className="fixed top-6 left-0 right-0 z-50 flex justify-center items-center gap-3 px-4">
      {/* Back Button - Desktop */}
      {showBack && (
        <Link
          to={backTo || "/"}
          className="hidden md:flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-105"
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          <ArrowLeft size={18} className="text-white/80" />
        </Link>
      )}

      {/* Desktop Navigation - Apple Liquid Glass Segmented Control */}
      <motion.div 
        ref={navRef}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="hidden md:flex items-center gap-0 px-1.5 py-1.5 rounded-full relative"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: `
            0 0 0 0.5px rgba(255, 255, 255, 0.05) inset,
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 2px 8px rgba(0, 0, 0, 0.2)
          `,
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Sliding Glass Indicator - Apple Segmented Control Style */}
        <motion.div
          className="absolute top-1.5 bottom-1.5 rounded-full pointer-events-none"
          initial={false}
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: 1,
            scaleX: 1,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
          style={{
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.12) 100%)",
            backdropFilter: "blur(20px) saturate(1.5)",
            boxShadow: `
              0 0 0 0.5px rgba(255, 255, 255, 0.3) inset,
              0 1px 0 0 rgba(255, 255, 255, 0.2) inset,
              0 4px 16px rgba(0, 0, 0, 0.2),
              0 2px 4px rgba(0, 0, 0, 0.1)
            `,
            border: "0.5px solid rgba(255, 255, 255, 0.15)",
          }}
        />

        {navItems.map((item, index) => {
          const isActive = displayIndex === index;
          const commonProps = {
            key: item.label,
            ref: (el: HTMLAnchorElement | null) => (itemRefs.current[index] = el),
            className: "relative px-5 py-2.5 text-sm font-medium rounded-full z-10 transition-colors duration-200",
            style: { 
              fontFamily: "Orbitron, sans-serif",
              color: isActive ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.7)",
            },
            onMouseEnter: () => setHoveredIndex(index),
          };

          if (item.isRoute) {
            return (
              <Link
                key={item.label}
                to={item.href}
                ref={(el) => (itemRefs.current[index] = el)}
                className={commonProps.className}
                style={commonProps.style}
                onMouseEnter={commonProps.onMouseEnter}
              >
                {item.label}
              </Link>
            );
          }

          if (item.external) {
            return (
              <a
                {...commonProps}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label}
              </a>
            );
          }

          return (
            <a {...commonProps} href={item.href}>
              {item.label}
            </a>
          );
        })}
      </motion.div>

      {/* Mobile Navigation */}
      <div className="md:hidden w-full">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center px-4 py-3 rounded-2xl mx-auto max-w-sm"
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div className="flex items-center gap-2">
            {showBack && (
              <Link
                to={backTo || "/"}
                className="p-2 text-white/80 rounded-full hover:bg-white/10 transition-colors"
              >
                <ArrowLeft size={18} />
              </Link>
            )}
            <span className="text-white font-semibold" style={{ fontFamily: "Orbitron, sans-serif" }}>
              UNVRS
            </span>
          </div>
          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-white/80 rounded-full"
            whileHover={{ scale: 1.1, background: "rgba(255, 255, 255, 0.1)" }}
            whileTap={{ scale: 0.9 }}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </motion.button>
        </motion.div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="mt-2 mx-auto max-w-sm rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                backdropFilter: "blur(40px) saturate(1.8)",
                WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              }}
            >
              <div className="p-2">
                {navItems.map((item, index) => {
                  if (item.isRoute) {
                    return (
                      <Link key={item.label} to={item.href} onClick={() => setIsOpen(false)}>
                        <motion.div
                          className="block px-4 py-3 text-white/80 rounded-xl"
                          style={{ fontFamily: "Orbitron, sans-serif" }}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ background: "rgba(255, 255, 255, 0.1)" }}
                        >
                          {item.label}
                        </motion.div>
                      </Link>
                    );
                  }

                  if (item.external) {
                    return (
                      <motion.a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 text-white/80 rounded-xl"
                        style={{ fontFamily: "Orbitron, sans-serif" }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ background: "rgba(255, 255, 255, 0.1)" }}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.label}
                      </motion.a>
                    );
                  }

                  return (
                    <motion.a
                      key={item.label}
                      href={item.href}
                      className="block px-4 py-3 text-white/80 rounded-xl"
                      style={{ fontFamily: "Orbitron, sans-serif" }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ background: "rgba(255, 255, 255, 0.1)" }}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </motion.a>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
