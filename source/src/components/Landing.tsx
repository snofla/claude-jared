import { MAX_BYTES } from '../lib/source'
import type { RecentEntry } from '../lib/storage'
import type { Theme } from '../lib/theme'
import { formatBytes } from '../lib/util'
import { IconBrand, IconButton, IconFile, IconUpload, IconX, LinkButton } from '../ui'
import { ThemeButton } from './ThemeButton'
import { Version } from './Version'

interface Props {
  recent: RecentEntry[]
  onPick: () => void
  onSample: () => void
  onSampleDiff: () => void
  onOpenRecent: (hash: string) => void
  onForget: (hash: string) => void
  theme: Theme
  onTheme: () => void
}

export function Landing({ recent, onPick, onSample, onSampleDiff, onOpenRecent, onForget, theme, onTheme }: Props) {
  return (
    <main className="landing">
      <div className="landing-inner">
        <div className="landing-top">
          <div className="brand brand-lg">
            <IconBrand /> Jared <Version />
          </div>
          <ThemeButton theme={theme} onNext={onTheme} />
        </div>
        <h1>Review code, line by line.</h1>
        <p className="lede">
          Open any source file, select the lines that matter, and leave a comment or a better implementation. Your review
          is saved as you go and can be exported at any time.
        </p>

        <button type="button" className="dropzone" onClick={onPick}>
          <IconUpload size={28} />
          <span className="dropzone-title">Drop a file here, or click to choose one</span>
          <span className="muted">Any text-based language, or a unified diff · up to {formatBytes(MAX_BYTES)}</span>
        </button>

        <p className="landing-alt">
          No file handy?{' '}
          <LinkButton onClick={onSample}>Try a sample</LinkButton>{' '}
          or{' '}
          <LinkButton onClick={onSampleDiff}>a sample diff</LinkButton>
        </p>

        {recent.length > 0 && (
          <section className="recent" aria-label="Recent reviews">
            <h2>Continue reviewing</h2>
            <ul>
              {recent.map((r) => (
                <li key={r.hash}>
                  <button type="button" className="recent-open" onClick={() => onOpenRecent(r.hash)}>
                    <IconFile />
                    <span className="recent-name">{r.name}</span>
                    <span className="muted">
                      {r.comments} comment{r.comments === 1 ? '' : 's'}
                      {r.submittedAt ? ' · exported' : ''}
                    </span>
                  </button>
                  <IconButton
                    label={`Forget ${r.name}`}
                    title="Forget this file and its review"
                    icon={<IconX />}
                    onClick={() => onForget(r.hash)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
