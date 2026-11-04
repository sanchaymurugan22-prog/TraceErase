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
      <section className="relative isolate overflow-hidden border-b border-line text-ink">
        <span className="aurora-blob -right-40 -top-40 size-[620px] bg-[#E3D6B4]/60" aria-hidden="true" />
        <div className="mx-auto max-w-[1320px] border-b border-line"><PublicNav light /></div>
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
