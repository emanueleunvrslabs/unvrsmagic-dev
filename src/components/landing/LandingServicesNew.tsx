import { Brain, Code, Smartphone, Cloud, Lightbulb, Cog, LucideIcon } from "lucide-react";
import { motion, TargetAndTransition } from "framer-motion";

interface ServiceItem {
  title: string;
  description: string;
  icon: LucideIcon;
  animation: TargetAndTransition;
}

const services: ServiceItem[] = [
  {
    title: "AI Integration",
    description: "Seamlessly integrate cutting-edge AI solutions into your existing infrastructure for enhanced automation and insights.",
    icon: Brain,
    animation: {
      scale: [1, 1.1, 1],
      opacity: [0.6, 1, 0.6],
    },
  },
  {
    title: "Custom Software",
    description: "Tailored enterprise applications built from the ground up to match your unique business requirements.",
    icon: Code,
    animation: {
      x: [-2, 2, -2],
      opacity: [0.6, 1, 0.6],
    },
  },
  {
    title: "Mobile Applications",
    description: "Native and cross-platform mobile solutions that deliver exceptional user experiences.",
    icon: Smartphone,
    animation: {
      rotate: [-5, 5, -5],
      opacity: [0.6, 1, 0.6],
    },
  },
  {
    title: "Cloud Architecture",
    description: "Design and implement scalable cloud infrastructure that grows with your business needs.",
    icon: Cloud,
    animation: {
      y: [-2, 2, -2],
      opacity: [0.6, 1, 0.6],
    },
  },
  {
    title: "Consulting & Strategy",
    description: "Expert guidance on digital transformation and technology roadmap planning.",
    icon: Lightbulb,
    animation: {
      scale: [1, 1.15, 1],
      filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"],
    },
  },
  {
    title: "DevOps & Automation",
    description: "Streamline your development pipeline with modern DevOps practices and automation.",
    icon: Cog,
    animation: {
      rotate: [0, 360],
    },
  },
];

export function LandingServicesNew() {
  return (
    <section id="services" className="py-32 bg-black relative overflow-hidden" aria-label="Our Services">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6">
        <div className="mb-16">
          <p
            className="text-white/60 text-sm mb-4 tracking-wider"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            What We Do
          </p>
          <h2
            className="text-5xl md:text-7xl font-bold text-white"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            Services
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const IconComponent = service.icon;
            return (
              <div
                key={service.title}
                className="liquid-glass-card p-8 h-full group cursor-pointer hover:bg-white/[0.06] transition-colors duration-300 flex flex-col"
              >
                <div className="relative z-10 flex flex-col h-full">
                  <h3
                    className="text-xl font-semibold text-white mb-4 group-hover:text-white/90 transition-colors duration-300"
                    style={{ fontFamily: "Orbitron, sans-serif" }}
                  >
                    {service.title}
                  </h3>
                  <p
                    className="text-white/60 text-sm leading-relaxed flex-grow"
                    style={{ fontFamily: "Orbitron, sans-serif" }}
                  >
                    {service.description}
                  </p>
                  <div className="flex items-center justify-center w-10 h-10 liquid-glass-pill group-hover:bg-white/10 transition-all overflow-hidden mt-6">
                    <motion.div
                      animate={service.animation}
                      transition={{ 
                        duration: service.title === "DevOps & Automation" ? 4 : 2,
                        repeat: Infinity, 
                        ease: service.title === "DevOps & Automation" ? "linear" : "easeInOut",
                      }}
                    >
                      <IconComponent size={18} className="text-white/80" />
                    </motion.div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}