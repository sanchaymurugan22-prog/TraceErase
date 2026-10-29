import { useT } from '@/i18n/I18nProvider';
import { Tile, type IconName } from '@/components/ui';

const AGENTS: [IconName, string, string][] = [
  ['search', 'Discovery agent', 'Finds every app and company holding your data, including ones you forgot.'],
  ['file', 'Policy reader', 'Reads long privacy policies and tells you what each company keeps and shares.'],
  ['edit', 'Request writer', "Writes legally correct requests in the company's format and in your language."],
  ['mailc', 'Reply checker', 'Checks every reply is genuine, lists what was kept and why, and finds the partners it names.'],
  ['siren', 'Leak investigator', 'When a stranger contacts you, it traces which company passed your details on.'],
  ['scale', 'Complaint drafter', 'Builds a complaint for the Data Protection Board with every piece of evidence.']
];

export function AiAgents() {
  const t = useT();
  return (
    <section id="ai" className="dots relative isolate overflow-hidden bg-navy px-10 py-28 text-on max-[820px]:px-4 max-[820px]:py-16">
      <span className="aurora-blob -right-32 -top-32 size-[560px] bg-[#14B8A6]/20" aria-hidden="true" />
      <span className="aurora-blob -bottom-40 -left-20 size-[520px] bg-[#2F66D6]/25 [animation-delay:-12s]" aria-hidden="true" />
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-[680px] flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-[.08em] text-accent-b">{t('Powered by Gemini, end to end')}</span>
            <h2 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-4xl">{t('AI agents work for your privacy.')}</h2>
          </div>
          <p className="max-w-[420px] text-onm">{t('Your name, email and number are masked before any AI sees them. AI explains; you decide.')}</p>
        </div>
        <div className="grid grid-cols-3 gap-5 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
          {AGENTS.map(([icon, h, p]) => (
            <div key={h} className="glass-dark flex flex-col gap-3 rounded-[26px] p-7 transition duration-300 hover:-translate-y-1 hover:border-accent-b/30 hover:bg-white/8">
              <Tile icon={icon} tone="dark" /><h3 className="text-xl font-bold text-white">{t(h)}</h3><p className="text-onm">{t(p)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
