import { CasePage } from './CasePage';

export default function InquiryCasePage({ params }: { params: Record<string, string> }) {
  return <CasePage key={params.id} kind="inquiry" id={params.id} />;
}
