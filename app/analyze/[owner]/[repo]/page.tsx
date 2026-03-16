import Header from '@/components/layout/Header'
import AnalysisHeader from '@/components/layout/AnalysisHeader'
import { TEXT_DIM } from '@/lib/color-schemes'

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
    <div className="min-h-screen">
      <Header />
      <div className="pt-14">
        <AnalysisHeader
          owner={owner}
          repo={repo}
        />

        {/* Visualization area placeholder */}
        <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-sm" style={{ color: TEXT_DIM }}>
              {id ? `Analysis ID: ${id}` : 'No analysis ID provided'}
            </p>
            <p className="mt-2 text-sm" style={{ color: TEXT_DIM }}>
              Visualization panels will render here
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
