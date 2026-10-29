// Regulator console: one case. A user's complaint, or a Board inquiry into a company that joins several complaints.
// Officers review the sealed evidence, ask AI for an assessment, send notices, record replies and decide.
import { useEffect, useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { fmtDate, fmtDateTime, shortHash } from '@/lib/format';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import {
  ActionButton, AiTag, Banner, Button, Card, Chip, ErrorBox, Field, Icon, Input, KeyValue, Modal, PageLoading,
  Select, Spinner, Steps, Textarea, Timeline, useToast
} from '@/components/ui';
import { CaseStatus, ComplaintTable, NoticeState } from '../shared';

type Kind = 'complaint' | 'inquiry';

export function CasePage({ kind, id }: { kind: Kind; id: string }) {
  const t = useT();
  const toast = useToast();
  const { data: c, loading, error, setData } = useApi<any>(`/regulator/${kind === 'complaint' ? 'complaints' : 'inquiries'}/${id}`);
  const [modal, setModal] = useState<null | 'notice' | 'decision' | 'dismiss'>(null);
  const [note, setNote] = useState('');

  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !c) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;

  const act = async (path: string, body: any = {}, msg?: string) => {
    const r = await post(`/regulator/${kind}/${c.id}/${path}`, body);
    setData(r);
    if (msg) toast(t(msg));
    return r;
  };
  const cs = c.case;
  const closed = cs.status === 'decided' || cs.status === 'dismissed';
  const step = { new: 0, review: 1, notice: 2, decided: 3, dismissed: 3 }[cs.status as string] ?? 0;
  const parties: any[] = c.parties || [];

  return (
    <RegulatorShell>
      <Link to={kind === 'complaint' ? '/regulator/complaints' : '/regulator/notices'} className="inline-flex items-center gap-1 self-start text-sm font-semibold"><Icon name="cl" size="sm" />{t(kind === 'complaint' ? 'All complaints' : 'Notices and inquiries')}</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t(kind === 'complaint' ? 'Complaint' : 'Board inquiry')}</span>
          <h1 className="font-mono text-3xl font-extrabold tracking-tight max-[820px]:text-2xl" translate="no">{c.reference}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <CaseStatus status={cs.status} />
            {kind === 'complaint' && c.autoFiled && <Chip icon="zap">{t('Filed automatically')}</Chip>}
            {kind === 'complaint' && c.demo && <Chip>{t('Demo account')}</Chip>}
            <span className="text-sm text-mute">{kind === 'complaint' ? t('Filed {date}', { date: fmtDateTime(c.filedAt) }) : t('Opened {date} by {who}', { date: fmtDateTime(c.openedAt), who: c.openedBy })}{cs.assignee ? ` · ${t('Officer: {name}', { name: cs.assignee })}` : ''}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {cs.status === 'new' && <ActionButton onClick={() => act('status', { status: 'review' }, 'Case taken up. The complainant has been told.')}><Icon name="check" size="sm" />{t('Take up this case')}</ActionButton>}
          {!closed && <Button variant="secondary" onClick={() => setModal('notice')}><Icon name="send" size="sm" />{t('Send notice')}</Button>}
          {!closed && <Button variant="dark" onClick={() => setModal('decision')}><Icon name="scale" size="sm" />{t('Decide')}</Button>}
          {closed && <ActionButton variant="secondary" onClick={() => act('status', { status: 'review', note: 'Reopened' }, 'Case reopened')}><Icon name="refresh" size="sm" />{t('Reopen')}</ActionButton>}
        </div>
      </div>

      <Card className="overflow-x-auto py-4"><Steps steps={[t(kind === 'complaint' ? 'Filed' : 'Opened'), t('Under review'), t('Notice sent'), t(cs.status === 'dismissed' ? 'Dismissed' : 'Decided')]} current={step} /></Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {cs.decision && <DecisionCard d={cs.decision} />}

          <Card className="gap-4">
            <h2 className="text-xl font-bold">{t(kind === 'complaint' ? 'What the complainant says' : 'Why this inquiry was opened')}</h2>
            <div className="flex flex-wrap gap-2">
              {parties.map((p: any) => (
                <Link key={p.name} to={`/regulator/companies/${p.key || slug(p.name)}`} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-ink no-underline hover:bg-soft hover:text-ink">
                  <Icon name="building" size="sm" /><span className="text-sm font-semibold" translate="no">{p.name}</span><span className="text-[13px] text-mute">· {t(p.issue)}</span>
                </Link>
              ))}
            </div>
            {kind === 'complaint' ? <>
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink2">{c.summary}</p>
              {!!c.asks?.length && <div className="flex flex-col gap-1.5"><b className="text-sm">{t('The complainant asks the Board to')}</b>{c.asks.map((a: string, i: number) => <span key={i} className="flex gap-2 text-sm text-ink2"><span className="text-mute">{i + 1}.</span>{a}</span>)}</div>}
            </> : <p className="text-[15px] text-ink2">{t(c.reason)}</p>}
            {!!c.facts?.length && (
              <div className="flex flex-col gap-2 rounded-2xl bg-soft p-4">
                <b className="text-sm">{t('Facts established from the records')}</b>
                {c.facts.map((f: string, i: number) => <span key={i} className="flex gap-2 text-sm text-ink2"><Icon name="check" size="sm" className="mt-0.5 flex-none text-ok" />{f}</span>)}
              </div>
            )}
          </Card>

          {kind === 'complaint' && (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-[18px]">
                <h2 className="text-xl font-bold">{t('Sealed evidence')}</h2>
                <Chip tone={c.evidence.every((e: any) => e.verified) ? 'ok' : 'pend'} icon="shieldc">{t('{a} of {b} verified just now', { a: c.evidence.filter((e: any) => e.verified).length, b: c.evidence.length })}</Chip>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>{t('Record')}</th><th>{t('What it proves')}</th><th>{t('Check')}</th><th /></tr></thead>
                  <tbody>
                    {c.evidence.map((e: any) => (
                      <tr key={e.receiptId}>
                        <td><div className="font-semibold">{t(e.label)}</div><div className="text-[13px] text-mute">{t(e.source)} · {fmtDate(e.at)}</div></td>
                        <td className="text-sm text-ink2">{t(e.proves)}</td>
                        <td>{e.verified ? <Chip tone="ok" icon="check">{t('Unchanged')}</Chip> : e.intact ? <Chip tone="pend" icon="clock">{t('Sealing')}</Chip> : <Chip tone="leak" icon="alert">{t('Changed')}</Chip>}
                          <div className="mt-1 font-mono text-[11px] text-mute" translate="no">{shortHash(e.hash, 8, 6)}</div></td>
                        <td><Link to={`/regulator/verify/${e.receiptId}`} className="whitespace-nowrap text-sm font-semibold">{t('Verify')}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-6 py-4 text-[13px] text-mute">{t('Each record was fingerprinted when it happened and sealed into the tamper-proof log. "Unchanged" means it was re-checked against its seal when you opened this page.')}</p>
            </Card>
          )}

          {kind === 'inquiry' && (
            <Card className="gap-0 overflow-hidden p-0">
              <h2 className="px-6 py-[18px] text-xl font-bold">{t('Complaints joined in this inquiry')}</h2>
              {c.complaints.length ? <ComplaintTable rows={c.complaints} compact /> : <p className="px-6 pb-6 text-sm text-mute">{t('No filed complaints yet. Opened from leak and deadline records.')}</p>}
            </Card>
          )}

          <Card className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">{t('Notices to companies')}</h2>
              {!closed && <Button size="sm" variant="secondary" onClick={() => setModal('notice')}><Icon name="plus" size="sm" />{t('New notice')}</Button>}
            </div>
            {!cs.notices.length && <p className="text-sm text-mute">{t('No notice sent yet. A notice asks the company to explain, erase the data and name everyone it shared it with, by a deadline.')}</p>}
            {cs.notices.map((n: any) => <NoticeCard key={n.id} n={n} closed={closed} onReply={(body: any) => act(`notices/${n.id}/reply`, body, 'Reply recorded and sealed')} />)}
          </Card>

          <Card>
            <h2 className="text-xl font-bold">{t('Timeline')}</h2>
            <Timeline items={c.timeline.map((x: any) => ({
              icon: x.icon, state: x.tone === 'warn' ? 'warn' : x.board ? 'current' : 'done',
              title: <span className="text-sm font-semibold">{t(x.title)}</span>,
              sub: <span className="text-[13px] text-mute">{fmtDateTime(x.at)}{x.sub ? ` · ${t(x.sub)}` : ''}</span>
            }))} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {kind === 'complaint' && c.complainant && (
            <Card className="gap-1">
              <h2 className="pb-2 text-lg font-bold">{t('Complainant')}</h2>
              <KeyValue label={t('Name')}><span translate="no">{c.complainant.name}</span></KeyValue>
              <KeyValue label={t('Email')}><span translate="no">{c.complainant.email}</span></KeyValue>
              {c.complainant.phone && <KeyValue label={t('Phone')}><span translate="no">{c.complainant.phone}</span></KeyValue>}
              <KeyValue label={t('Request signed with')}>{c.complainant.passkey ? t('Passkey') : t('Account')}</KeyValue>
              <span className="pt-2 text-[12.5px] text-mute">{t('Contact details are partly hidden. The Board contacts the complainant through TraceErase alerts.')}</span>
            </Card>
          )}

          <Assessment c={c} onRun={() => act('assess', {}, 'Assessment updated')} onNotice={() => setModal('notice')} onDecide={() => setModal('decision')} closed={closed} />

          {kind === 'complaint' && c.inquiry && (
            <Banner tone="info" icon="layers"><span>{t('Part of inquiry')} <Link to={`/regulator/inquiries/${c.inquiry.id}`} className="font-semibold" translate="no">{c.inquiry.reference}</Link></span></Banner>
          )}

          <Card className="gap-3">
            <h2 className="text-lg font-bold">{t('Case status')}</h2>
            <Select value={cs.status} aria-label={t('Case status')} onChange={async e => {
              const v = e.target.value;
              if (v === 'decided') { setModal('decision'); return; }
              if (v === 'dismissed') { setModal('dismiss'); return; }
              try { await act('status', { status: v }, 'Status changed'); } catch (err: any) { toast(t(err.message), 'err'); }
            }}>
              {[['new', 'New'], ['review', 'Under review'], ['notice', 'Notice sent'], ['decided', 'Decided'], ['dismissed', 'Dismissed']].map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
            </Select>
            <span className="text-[12.5px] text-mute">{t('Every change is sealed in the tamper-proof log and shown to the complainant.')}</span>
          </Card>

          <Card className="gap-3">
            <h2 className="text-lg font-bold">{t('Officer notes')} <span className="text-sm font-normal text-mute">· {t('internal')}</span></h2>
            {cs.notes.map((n: any, i: number) => (
              <div key={i} className="rounded-xl bg-soft p-3 text-sm"><div className="whitespace-pre-wrap text-ink2">{n.text}</div><div className="pt-1 text-[12px] text-mute">{n.by} · {fmtDateTime(n.at)}</div></div>
            ))}
            <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={t('Add a note for other officers')} aria-label={t('Add a note')} />
            <ActionButton size="sm" variant="secondary" disabled={!note.trim()} onClick={async () => { await act('notes', { text: note }); setNote(''); }}>{t('Add note')}</ActionButton>
          </Card>
        </div>
      </div>

      {modal === 'notice' && <NoticeModal kind={kind} c={c} onClose={() => setModal(null)} onSent={(r: any) => { setData(r); setModal(null); toast(t('Notice sent and sealed')); }} />}
      {(modal === 'decision' || modal === 'dismiss') && <DecisionModal kind={kind} c={c} dismiss={modal === 'dismiss'} onClose={() => setModal(null)} onDone={(r: any) => { setData(r); setModal(null); toast(t('Decision recorded and sealed')); }} />}
    </RegulatorShell>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function DecisionCard({ d }: { d: any }) {
  const t = useT();
  const dismissed = d.outcome === 'dismiss';
  return (
    <Card className={dismissed ? 'gap-3' : 'gap-3 border-[1.5px] border-[#9BD3B0]'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-bold text-ok"><Icon name="scale" size="sm" />{t('Board order')} <span className="font-mono" translate="no">{d.order}</span></span>
        <Link to={`/regulator/verify/${d.receiptId}`} className="text-sm font-semibold">{t('Verify seal')}</Link>
      </div>
      <h2 className="text-2xl font-extrabold">{t(d.label)}{d.penaltyCrore ? ` · ₹${d.penaltyCrore} ${t('crore')}` : ''}</h2>
      <p className="whitespace-pre-wrap text-ink2">{d.directions}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-mute">
        <span>{t('Decided {date} by {who}', { date: fmtDateTime(d.at), who: d.by })}</span>
        {d.complyBy && <span>{t('Comply by {date}', { date: fmtDate(d.complyBy) })}</span>}
        {d.penaltyLabel && <span>{t(d.penaltyLabel)}</span>}
      </div>
    </Card>
  );
}

function NoticeCard({ n, closed, onReply }: { n: any; closed: boolean; onReply: (b: any) => Promise<any> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <b className="text-[15px]" translate="no">{n.company}</b>
          <span className="text-[13px] text-mute">{t('Sent {date} · reply due {due}', { date: fmtDate(n.sentAt), due: fmtDate(n.dueAt) })}</span>
        </div>
        <NoticeState state={n.state} />
      </div>
      <button type="button" onClick={() => setOpen(o => !o)} className="self-start border-0 bg-transparent p-0 text-sm font-semibold text-brand">{t(open ? 'Hide notice' : 'Read notice')}</button>
      {open && <div className="whitespace-pre-wrap rounded-xl bg-soft p-4 text-sm leading-6 text-ink2"><b className="block pb-2">{n.subject}</b>{n.body}</div>}
      {n.reply ? (
        <div className={`flex flex-col gap-2 rounded-xl p-4 text-sm ${n.reply.complies ? 'bg-ok-s' : 'bg-nr-s'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <AiTag ai={n.reply.ai} label="AI read the reply" />
            <Chip tone={n.reply.complies ? 'ok' : 'nr'}>{t(n.reply.complies ? 'Complies' : 'Does not comply')}</Chip>
            {n.reply.simulated && <Chip>{t('Simulated reply')}</Chip>}
            <span className="text-[12px] text-mute">{fmtDateTime(n.reply.at)}</span>
          </div>
          <span className="text-ink2">{t(n.reply.summary)}</span>
          {!!n.reply.gaps?.length && <ul className="m-0 list-disc pl-5 text-ink2">{n.reply.gaps.map((g: string) => <li key={g}>{t(g)}</li>)}</ul>}
          <details><summary className="cursor-pointer font-semibold text-brand">{t('Full reply')}</summary><div className="whitespace-pre-wrap pt-2 text-ink2">{n.reply.text}</div></details>
        </div>
      ) : !closed && (
        paste === null ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPaste('')}><Icon name="edit" size="sm" />{t('Record reply')}</Button>
            <ActionButton size="sm" variant="ghost" onClick={() => onReply({ simulate: 'comply' })}>{t('Simulate: company complies')}</ActionButton>
            <ActionButton size="sm" variant="ghost" onClick={() => onReply({ simulate: 'dispute' })}>{t('Simulate: company disputes')}</ActionButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Textarea rows={5} value={paste} onChange={e => setPaste(e.target.value)} placeholder={t("Paste the company's reply")} aria-label={t("Company's reply")} />
            <div className="flex gap-2">
              <ActionButton size="sm" disabled={!paste.trim()} onClick={async () => { await onReply({ text: paste }); setPaste(null); }}>{t('Save and check with AI')}</ActionButton>
              <Button size="sm" variant="ghost" onClick={() => setPaste(null)}>{t('Cancel')}</Button>
            </div>
          </div>
        )
      )}
      {!n.reply && <span className="text-[12px] text-mute">{t('Prototype: notices are recorded in the Board portal and are not emailed to the company.')}</span>}
    </div>
  );
}

function Assessment({ c, onRun, onNotice, onDecide, closed }: { c: any; onRun: () => Promise<any>; onNotice: () => void; onDecide: () => void; closed: boolean }) {
  const t = useT();
  const a = c.case.assessment;
  const tone = a?.strength === 'strong' ? 'ok' : a?.strength === 'moderate' ? 'part' : 'leak';
  return (
    <Card className="gap-3 border-[1.5px] border-accent/30">
      <div className="flex items-center justify-between gap-3">
        <AiTag ai={a ? a.ai : undefined} label="AI case assessment" />
        {a && <span className="text-[12px] text-mute">{fmtDateTime(a.at)}</span>}
      </div>
      {!a ? <>
        <p className="text-sm text-mute">{t('AI reads the facts, the evidence checks and any replies, then lists which DPDP duties look broken and suggests a next step. Personal details are hidden from AI. You make the decision.')}</p>
        <ActionButton variant="accent" onClick={onRun}><Icon name="sparkle" size="sm" />{t('Assess this case')}</ActionButton>
      </> : <>
        <div className="flex items-center gap-2"><span className="text-sm font-semibold">{t('Evidence strength')}</span><Chip tone={tone as any}>{t(a.strength === 'strong' ? 'Strong' : a.strength === 'moderate' ? 'Moderate' : 'Weak')}</Chip></div>
        <p className="text-sm text-ink2">{t(a.summary)}</p>
        {!!a.breaches?.length && (
          <div className="flex flex-col gap-2">
            <b className="text-sm">{t('Duties that look broken')}</b>
            {a.breaches.map((b: any, i: number) => <div key={i} className="rounded-xl bg-soft p-2.5 text-[13px]"><b className="block">{b.section}</b><span className="text-ink2">{t(b.what)}</span></div>)}
          </div>
        )}
        <div className="rounded-xl bg-accent-s p-3 text-sm"><b className="block text-accent">{t('Suggested next step')}</b><span className="text-ink2">{t(a.recommendation)}</span></div>
        {!closed && a.nextStep === 'notice' && <Button variant="secondary" onClick={onNotice}><Icon name="send" size="sm" />{t('Draft the notice')}</Button>}
        {!closed && a.nextStep === 'decide' && <Button variant="secondary" onClick={onDecide}><Icon name="scale" size="sm" />{t('Make a decision')}</Button>}
        <ActionButton size="sm" variant="ghost" onClick={onRun}><Icon name="refresh" size="sm" />{t('Assess again')}</ActionButton>
      </>}
    </Card>
  );
}

function NoticeModal({ kind, c, onClose, onSent }: { kind: Kind; c: any; onClose: () => void; onSent: (r: any) => void }) {
  const t = useT();
  const toast = useToast();
  const names: string[] = (c.parties || []).map((p: any) => p.name);
  const [company, setCompany] = useState(names[0] || '');
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const load = async (co: string) => {
    setBusy(true);
    try { setDraft(await post(`/regulator/${kind}/${c.id}/notice/draft`, { company: co })); }
    catch (e: any) { toast(t(e.message), 'err'); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(company); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal label={t('Send notice')} onClose={onClose} wide>
      <div className="flex flex-col gap-1"><h2 className="text-2xl font-extrabold">{t('Notice to a company')}</h2><p className="text-sm text-mute">{t('AI drafted this from the case facts. Edit anything before sending.')}</p></div>
      {names.length > 1 && <Field label={t('Company')}><Select value={company} onChange={e => { setCompany(e.target.value); setDraft(null); load(e.target.value); }}>{names.map(n => <option key={n}>{n}</option>)}</Select></Field>}
      {busy || !draft ? <div className="flex items-center gap-3 py-8 text-mute"><Spinner />{t('AI is drafting the notice…')}</div> : <>
        <AiTag ai={draft.ai} label="Drafted by AI" />
        <Field label={t('Subject')}><Input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} /></Field>
        <Field label={t('Notice')}><Textarea rows={13} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} /></Field>
        <Field label={t('Days to reply')}><Input type="number" min={1} max={30} value={draft.days} onChange={e => setDraft({ ...draft, days: e.target.value })} className="max-w-[140px]" /></Field>
        <Banner tone="info" icon="info">{t('Prototype: the notice is sealed and recorded in the Board portal. It is not emailed to the company.')}</Banner>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
          <Button loading={sending} onClick={async () => {
            setSending(true);
            try { onSent(await post(`/regulator/${kind}/${c.id}/notice`, { ...draft, company })); }
            catch (e: any) { toast(t(e.message), 'err'); setSending(false); }
          }}><Icon name="send" size="sm" />{t('Seal and send notice')}</Button>
        </div>
      </>}
    </Modal>
  );
}

const OUTCOMES: [string, string, string, string][] = [
  ['direct', 'Direct erasure', 'Order the company to erase the data, make its partners erase it, and confirm in writing.', 'Within {days} days, erase all personal data of the Data Principal, instruct every party it was shared with to erase it, and confirm to the Board in writing with each party\'s confirmation.'],
  ['undertaking', 'Accept an undertaking', 'The company promises to fix the problem (Section 32). Breaking it leads to a penalty.', 'The Board accepts the company\'s voluntary undertaking to erase the data within {days} days, fix its grievance process, and report back. Breach of this undertaking will be treated as a breach of the Act.'],
  ['penalty', 'Impose a penalty', 'A money penalty under the Schedule to the DPDP Act, plus directions.', 'The company is directed to erase the personal data within {days} days and to pay the penalty below within 60 days.'],
  ['dismiss', 'Dismiss', 'Close the case because the evidence does not show a breach.', '']
];

function DecisionModal({ kind, c, dismiss, onClose, onDone }: { kind: Kind; c: any; dismiss: boolean; onClose: () => void; onDone: (r: any) => void }) {
  const t = useT();
  const toast = useToast();
  const [outcome, setOutcome] = useState(dismiss ? 'dismiss' : 'direct');
  const [days, setDays] = useState(15);
  const [directions, setDirections] = useState(dismiss ? '' : OUTCOMES[0][3].replace('{days}', '15'));
  const [penaltyKind, setPenaltyKind] = useState('other');
  const [amount, setAmount] = useState('5');
  const [busy, setBusy] = useState(false);
  const cap = (c.penaltyCaps || []).find((p: any) => p.key === penaltyKind);
  const pick = (o: string) => { setOutcome(o); setDirections((OUTCOMES.find(x => x[0] === o)?.[3] || '').replace('{days}', String(days))); };
  return (
    <Modal label={t('Decide')} onClose={onClose} wide>
      <div className="flex flex-col gap-1"><h2 className="text-2xl font-extrabold">{t('Decide {ref}', { ref: c.reference })}</h2><p className="text-sm text-mute">{t('The order is sealed in the tamper-proof log, and the complainant is told straight away.')}</p></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {OUTCOMES.map(([k, l, s]) => (
          <button key={k} type="button" onClick={() => pick(k)} className={`flex flex-col gap-1 rounded-2xl border-[1.5px] p-4 text-left ${outcome === k ? 'border-brand bg-brand-s' : 'border-line bg-card hover:bg-soft'}`}>
            <b className="text-[15px]">{t(l)}</b><span className="text-[13px] text-mute">{t(s)}</span>
          </button>
        ))}
      </div>
      {outcome === 'penalty' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label={t('Breach')}><Select value={penaltyKind} onChange={e => setPenaltyKind(e.target.value)}>{(c.penaltyCaps || []).map((p: any) => <option key={p.key} value={p.key}>{t(p.label)}</option>)}</Select></Field>
          <Field label={t('Penalty (₹ crore)')} hint={cap ? t('Up to ₹{n} crore', { n: cap.max }) : undefined}><Input type="number" min={0.01} step="0.5" max={cap?.max} value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        </div>
      )}
      {outcome !== 'dismiss' && <Field label={t('Days to comply')}><Input type="number" min={1} max={90} value={days} onChange={e => setDays(Number(e.target.value))} className="max-w-[140px]" /></Field>}
      <Field label={t(outcome === 'dismiss' ? 'Reason (optional)' : 'Directions to the company')}><Textarea rows={5} value={directions} onChange={e => setDirections(e.target.value)} /></Field>
      <Banner tone="info" icon="info">{t('Prototype console: orders here have no legal effect.')}</Banner>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
        <Button variant={outcome === 'dismiss' ? 'secondary' : 'dark'} loading={busy} onClick={async () => {
          setBusy(true);
          try { onDone(await post(`/regulator/${kind}/${c.id}/decision`, { outcome, directions, days, penaltyKind, penaltyCrore: Number(amount) })); }
          catch (e: any) { toast(t(e.message), 'err'); setBusy(false); }
        }}><Icon name="scale" size="sm" />{t(outcome === 'dismiss' ? 'Dismiss case' : 'Seal and issue order')}</Button>
      </div>
    </Modal>
  );
}

