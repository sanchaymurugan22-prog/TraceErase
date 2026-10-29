// Screen 3: Welcome / landing page.
import { PublicNav } from '@/components/layout/PublicNav';
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { AiAgents } from './sections/AiAgents';
import { Audiences } from './sections/Audiences';
import { Footer } from './sections/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <section className="dots relative isolate overflow-hidden bg-navy text-on">
        <span className="aurora-blob -left-40 -top-40 size-[640px] bg-[#14B8A6]/25" aria-hidden="true" />
        <span className="aurora-blob -right-40 top-10 size-[620px] bg-[#2F66D6]/30 [animation-delay:-10s]" aria-hidden="true" />
        <span className="particles right-0 top-10 h-[640px] w-[820px] opacity-70 max-[1100px]:hidden" aria-hidden="true" />
        <PublicNav />
        <Hero />
      </section>
      <Problem />
      <HowItWorks />
      <AiAgents />
      <Audiences />
      <Footer />
    </div>
  );
}
