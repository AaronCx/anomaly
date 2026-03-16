import Header from '@/components/layout/Header'
import AnalysisHeader from '@/components/layout/AnalysisHeader'
import AnalysisViewWrapper from './AnalysisViewWrapper'

interface AnalysisPageProps {
  params: Promise<{ owner: string; repo: string }>
  searchParams: Promise<{ id?: string }>
}

export default async function AnalysisPage({
  params,
  searchParams,
}: AnalysisPageProps) {
  const { owner, repo } = await params
  const { id } = await searchParams

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 flex-col pt-14">
        <AnalysisHeader owner={owner} repo={repo} />
        <div className="flex-1">
          <AnalysisViewWrapper owner={owner} repo={repo} analysisId={id} />
        </div>
      </div>
    </div>
  )
}
