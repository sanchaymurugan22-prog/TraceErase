// Public receipt verification: anyone can check a receipt ID against the ledger.
import { useState } from 'react';
import { Link, useNavigate, useRouter } from '@/lib/router';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { apiUrl } from '@/lib/api';
import { fmtDateTime, shortHash } from '@/lib/format';
import { PublicNav } from '@/components/layout/PublicNav';
import { Banner, Button, Card, ErrorBox, Icon, Input, KeyValue, Spinner, buttonClass } from '@/components/ui';

export default function VerifyReceiptPage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const navigate = useNavigate();
  const { path } = useRouter();
  const inConsole = path.startsWith('/regulator');
  const base = inConsole ? '/regulator/verify/' : '/verify/';
  const [id, setId] = useState(params.id || '');
  const { data, error, loading } = useApi<any>(params.id ? '/verify/' + params.id : null);
  // Ask the public blockchain itself (only when this seal was published there)
  const { data: chain, loading: chainLoading } = useApi<any>(params.id && data?.batch?.txHash ? '/verify/' + params.id + '/chain' : null);

  const body = (
      <div className={inConsole ? 'flex max-w-[820px] flex-col gap-5' : 'mx-auto flex max-w-[760px] flex-col gap-5 px-6 py-10'}>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">{t('Verify a receipt')}</h1>
          <p className="text-mute">{t('Every important step of a deletion (your signed request, a company\'s reply, a certificate) gets a receipt with its own code. Paste that code here to check the record is genuine and has not been changed since it was made. Anyone can do this without an account: a company, a lawyer or the Data Protection Board.')}</p>
        </div>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (id.trim()) navigate(base + encodeURIComponent(id.trim())); }}>
          <Input value={id} onChange={e => setId(e.target.value)} placeholder={t('Receipt ID')} aria-label={t('Receipt ID')} className="font-mono" />
          <Button type="submit" size="lg"><Icon name="shieldc" />{t('Verify')}</Button>
        </form>
        {loading && <Spinner />}
        <ErrorBox error={error} />
        {data && !data.found && <Banner tone="leak" icon="alert">{t('No receipt with this ID exists in this ledger.')}</Banner>}
        {data?.found && (
          <Card className="gap-3.5">
            <Banner tone={data.valid ? 'ok' : data.anchored ? 'leak' : 'info'} icon={data.valid ? 'shieldc' : 'clock'}>
              <span className="font-semibold">{t(data.valid ? 'Genuine. This record has not been changed since it was created.' : data.anchored ? 'Warning: this record was changed after it was created.' : 'Genuine. It will be sealed into the tamper-proof log within a minute.')}</span>
            </Banner>
            <KeyValue label={t('What this record is')}>{t(data.receipt.title)}</KeyValue>
            <KeyValue label={t('Created on')}>{fmtDateTime(data.receipt.issuedAt)}</KeyValue>
            <KeyValue label={t('Unique code of this record')}><span className="break-all rounded-lg bg-soft px-2 py-1 font-mono text-xs" translate="no">{data.receipt.hash}</span></KeyValue>
            {data.batch && <>
              <KeyValue label={t('Sealed in')}>{t('Seal #{n} ({m} records in this seal)', { n: data.batch.number, m: data.batch.size })}</KeyValue>
              <KeyValue label={t('Code of the seal')}><span className="font-mono text-xs" translate="no">{shortHash(data.batch.root, 12, 8)}</span></KeyValue>
              <KeyValue label={t('Kept in')}>{t(String(data.batch.network).replace('TraceErase local ledger', 'TraceErase tamper-proof log'))}{data.batch.txHash ? ` · tx ${shortHash(data.batch.txHash)}` : ''}</KeyValue>
              <KeyValue label={t('Checks')}>{t('Not changed')} {data.intact ? '✓' : '✗'} · {t('Inside its seal')} {data.inBatch ? '✓' : '✗'} · {t('Seals unbroken')} {data.chainOk ? '✓' : '✗'}{data.signed ? <> · {t('Signature')} {data.signatureOk ? '✓' : '✗'}</> : null}</KeyValue>
            </>}
            {data.signed && (
              <KeyValue label={t('Digital signature')}>
                <span className={data.signatureOk ? 'font-semibold text-ok' : 'font-semibold text-leak'}>{data.signatureOk ? '✓ ' + t('Signed by TraceErase') : '✗ ' + t('Signature does not match: not issued by TraceErase, or changed')}</span>
                <span className="block text-[13px] text-mute">Ed25519 · {t('key')} <span className="font-mono" translate="no">{data.signer}</span> · <a href={apiUrl('/api/public-key')} target="_blank" rel="noopener noreferrer">{t('public key')}</a></span>
              </KeyValue>
            )}
            {data.batch?.txHash && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-accent/25 bg-accent-s p-4">
                <span className="flex items-center gap-2 font-semibold text-ink"><Icon name="cube" size="sm" className="text-accent" />{t('Published on a public blockchain')}</span>
                <span className="text-sm text-ink2">
                  {chainLoading ? t('Asking the blockchain…')
                    : chain?.onChain ? '✓ ' + t('{network} confirms this seal. Not even TraceErase can change it now.', { network: data.batch.network })
                    : chain?.checked ? '✗ ' + t('The blockchain record does not match this seal.')
                    : t('Waiting for the blockchain to confirm. This usually takes under a minute.')}
                </span>
                {data.batch.explorerUrl && <a href={data.batch.explorerUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm') + ' self-start'}><Icon name="ext" size="sm" />{t('View on PolygonScan')}</a>}
              </div>
            )}
          </Card>
        )}
        {!inConsole && (
          <Link to="/proof" className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent-s p-4 text-ink no-underline hover:border-accent/50 hover:text-ink">
            <span className="inline-flex size-10 flex-none items-center justify-center rounded-xl bg-card text-accent"><Icon name="cube" /></span>
            <span className="flex-1"><b className="block">{t('Watch the whole ledger live')}</b><span className="text-sm text-ink2">{t('The Proof Explorer shows every seal as it is made and published, with no personal data.')}</span></span>
            <Icon name="ar" className="text-accent" />
          </Link>
        )}
        <Card className="gap-3">
          <h2 className="text-lg font-bold">{t('How this check works')}</h2>
          {[
            ['hash', 'When something happens (you sign a request, a company replies), TraceErase turns that record into a unique code, like a fingerprint. Change even one letter of the record and the code changes completely.'],
            ['cube', 'Every minute, new codes are sealed together, and each seal also includes the seal before it. So an old record cannot be quietly changed later without breaking every seal after it.'],
            ['key', 'TraceErase also signs every code with its own digital signature. Anyone can check it with TraceErase\'s public key, so a fake or edited receipt is caught at once.'],
            ['link', 'When public publishing is switched on, each seal is also written on the Polygon blockchain, which thousands of computers keep. Then nobody, not even TraceErase, can quietly rewrite the history.'],
            ['shieldc', 'This page recalculates the code and checks the seals. If everything matches, the record is genuine. Only the code is stored in the seal, never your personal details.']
          ].map(([ic, txt], i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-ink2"><span className="inline-flex size-8 flex-none items-center justify-center rounded-lg bg-accent-s text-accent"><Icon name={ic as any} size="sm" /></span><span>{t(txt)}</span></div>
          ))}
        </Card>
      </div>
  );
  if (inConsole) return <RegulatorShell>{body}</RegulatorShell>;
  return (
    <div className="min-h-screen">
      <div className="dots relative isolate overflow-hidden bg-navy text-on">
        <span className="aurora-blob -left-40 -top-40 size-[600px] bg-[#A8D5BE]/22" aria-hidden="true" />
        <span className="aurora-blob -right-40 -top-20 size-[560px] bg-[#C9B98F]/28 [animation-delay:-10s]" aria-hidden="true" />
        <PublicNav />
      </div>
      <main>{body}</main>
    </div>
  );
}
