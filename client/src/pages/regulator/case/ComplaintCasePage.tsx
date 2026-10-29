import { CasePage } from './CasePage';

export default function ComplaintCasePage({ params }: { params: Record<string, string> }) {
  return <CasePage key={params.id} kind="complaint" id={params.id} />;
}
