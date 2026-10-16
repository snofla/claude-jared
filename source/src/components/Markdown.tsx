import { Fragment, useMemo, type ReactNode } from 'react'
import { useTokens } from '../hooks/useTokens'
import { COPY } from '../lib/copy'
import { languageOfFence } from '../lib/language'
import { renderMarkdown, type MarkdownBlock, type MarkdownInline } from '../lib/markdown'
import { VisuallyHidden } from '../ui'
import { Tokens } from './Tokens'

/** The address of a link as it is written after the link in a preview: without `https://`, `http://` or `mailto:`, which the reader does not need. */
const shownAddress = (url: string): string => url.replace(/^(https?:\/\/|mailto:)/i, '')

function Inline({ nodes, showAddresses }: { nodes: MarkdownInline[]; showAddresses: boolean }): ReactNode {
  return nodes.map((node, i) => {
    switch (node.kind) {
      case 'text':
        return <Fragment key={i}>{node.text}</Fragment>
      case 'break':
        return <br key={i} />
      case 'bold':
        return (
          <strong key={i}>
            <Inline nodes={node.children} showAddresses={showAddresses} />
          </strong>
        )
      case 'italic':
        return (
          <em key={i}>
            <Inline nodes={node.children} showAddresses={showAddresses} />
          </em>
        )
      case 'code':
        return <code key={i}>{node.text}</code>
      case 'link':
        return (
          <Fragment key={i}>
            <a href={node.url} target="_blank" rel="noopener noreferrer" title={node.url}>
              <Inline nodes={node.children} showAddresses={showAddresses} />
              <VisuallyHidden>{COPY.opensInNewTab}</VisuallyHidden>
            </a>
            {showAddresses && <span className="md-url">{shownAddress(node.url)}</span>}
          </Fragment>
        )
    }
  })
}

/** A fenced block, coloured as code of the language that the word after its fence names, and drawn plain until the colours are ready. */
function CodeBlock({ language, text }: { language: string | null; text: string }) {
  const tokens = useTokens(text, languageOfFence(language))
  return (
    <pre>
      <code>
        {text.split('\n').map((line, i) => (
          <Fragment key={i}>
            {i > 0 && '\n'}
            <Tokens tokens={tokens?.[i]} fallback={line} />
          </Fragment>
        ))}
      </code>
    </pre>
  )
}

function Blocks({ blocks, showAddresses }: { blocks: MarkdownBlock[]; showAddresses: boolean }): ReactNode {
  return blocks.map((block, i) => {
    switch (block.kind) {
      case 'paragraph':
        return (
          <p key={i}>
            <Inline nodes={block.children} showAddresses={showAddresses} />
          </p>
        )
      case 'list': {
        const items = block.items.map((item, j) => (
          <li key={j}>
            <Inline nodes={item} showAddresses={showAddresses} />
          </li>
        ))
        return block.ordered ? (
          <ol key={i} start={block.start === 1 ? undefined : block.start}>
            {items}
          </ol>
        ) : (
          <ul key={i}>{items}</ul>
        )
      }
      case 'quote':
        return (
          <blockquote key={i}>
            <Blocks blocks={block.children} showAddresses={showAddresses} />
          </blockquote>
        )
      case 'code':
        return <CodeBlock key={i} language={block.language} text={block.text} />
    }
  })
}

/**
 * The words of a comment, drawn as Markdown from the renderer's tree: never as HTML, so that nothing in the words can become markup. A link opens in a new tab and
 * has its address as its tooltip; `showAddresses` also writes the address after it, as the preview does.
 */
export function Markdown({ text, showAddresses = false }: { text: string; showAddresses?: boolean }) {
  const blocks = useMemo(() => renderMarkdown(text), [text])
  return <Blocks blocks={blocks} showAddresses={showAddresses} />
}
