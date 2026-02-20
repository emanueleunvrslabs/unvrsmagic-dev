import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHeroNew } from "@/components/landing/LandingHeroNew";
import { LandingBrands } from "@/components/landing/LandingBrands";
import { LandingClaim } from "@/components/landing/LandingClaim";
import { LandingWorksNew } from "@/components/landing/LandingWorksNew";
import { LandingServicesNew } from "@/components/landing/LandingServicesNew";
import { LandingScrollText } from "@/components/landing/LandingScrollText";
import { LandingReviews } from "@/components/landing/LandingReviews";
import { LandingStats } from "@/components/landing/LandingStats";
import { LandingCTANew } from "@/components/landing/LandingCTANew";
import { LandingFooterNew } from "@/components/landing/LandingFooterNew";
import { LandingFlagshipProjects } from "@/components/landing/LandingFlagshipProjects";
import { LandingAvatarShowcase } from "@/components/landing/LandingAvatarShowcase";
import { Helmet } from "react-helmet-async";

const Landing = () => {
  return (
    <>
      <Helmet>
        <title>UNVRS LABS — AI Integration, Custom Software & Digital Solutions</title>
        <meta name="description" content="UNVRS LABS is a technology studio specializing in AI integration, custom enterprise software, mobile applications, cloud architecture, and digital transformation. We build scalable, innovative solutions that drive business growth." />
        <link rel="canonical" href="https://unvrsmagic.lovable.app/" />
      </Helmet>
      <main className="bg-black min-h-screen" role="main">
        <LandingNav />
        <LandingHeroNew />
        <LandingClaim />
        <LandingBrands />
        <LandingServicesNew />
        <LandingScrollText />
        <LandingWorksNew />
        <LandingAvatarShowcase />
        <LandingFlagshipProjects />
        <LandingStats />
        <LandingReviews />
        <LandingCTANew />
        <LandingFooterNew />
      </main>
    </>
  );
};

export default Landing;
