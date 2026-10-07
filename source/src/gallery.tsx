import { StrictMode, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Kbd, LinkButton, LiveStatus, Notice, Select, TextField } from './ui'
import './styles.css'
import './gallery.css'

/**
 * The gallery of the component library: every component in every state, the light scheme and the dark one side by side, so that a change to
 * a component is seen in all of them at once. A page of the dev server (`gallery.html`; the production build does not include it), which imports the library and the stylesheet and nothing
 * else of the app. Hover, focus and press are live: use the mouse and Tab. Every string here is this page's own: the library holds no English.
 */

/** A stand-in for an icon: the library has no icons yet. */
const Dot = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="gallery-group">
      <h3>{title}</h3>
      <div className="gallery-row">{children}</div>
    </section>
  )
}

function ButtonStates() {
  const [on, setOn] = useState(false)
  const [reached, setReached] = useState(0)
  return (
    <>
      <Group title="Variants">
        <Button>Default</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </Group>
      <Group title="Small size">
        <Button size="sm">Default</Button>
        <Button size="sm" variant="primary">
          Primary
        </Button>
        <Button size="sm" variant="ghost">
          Ghost
        </Button>
        <Button size="sm" variant="danger">
          Danger
        </Button>
      </Group>
      <Group title="Icon and label">
        <Button icon={<Dot />}>Open…</Button>
        <Button variant="primary" icon={<Dot />}>
          Submit review
        </Button>
        <Button size="sm" variant="primary" icon={<Dot />}>
          Comment
        </Button>
      </Group>
      <Group title="Icon only">
        <Button iconOnly icon={<Dot />} aria-label="Colour scheme: system" title="Colour scheme: system" />
        <Button iconOnly variant="ghost" icon={<Dot />} aria-label="Add" />
      </Group>
      <Group title="Pressed (a toggle): off, on, and one that you can press (hover over the one that is on: it stays on and its border thickens)">
        <Button pressed={false} icon={<Dot />}>
          Off
        </Button>
        <Button pressed icon={<Dot />}>
          On
        </Button>
        <Button pressed={on} icon={<Dot />} onClick={() => setOn(!on)}>
          {on ? 'On' : 'Off'}: press me
        </Button>
      </Group>
      <Group title="Disabled, and busy (a busy button keeps the focus and ignores the click)">
        <Button disabled>Disabled</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button busy onClick={() => setReached(reached + 1)}>
          Busy
        </Button>
        <Button variant="primary" busy onClick={() => setReached(reached + 1)}>
          Busy
        </Button>
        <span className="muted">Clicks that got through to a busy button: {reached} (it must stay 0)</span>
      </Group>
      <Group title="A long label">
        <Button variant="primary">A label that is much longer than the others on this page, to see how a button grows</Button>
      </Group>
    </>
  )
}

function PrimitiveStates() {
  const [said, setSaid] = useState<string | null>(null)
  return (
    <>
      <h3 className="gallery-component">Kbd</h3>
      <Group title="A key hint, in a line of text and in a button">
        <span>
          Press <Kbd>C</Kbd> to comment, <Kbd>Esc</Kbd> to cancel
        </span>
        <Button variant="primary" size="sm" icon={<Dot />}>
          Comment <Kbd>C</Kbd>
        </Button>
      </Group>

      <h3 className="gallery-component">LinkButton</h3>
      <Group title="An action in a line of text, and one that is disabled">
        <span>
          No file handy? <LinkButton>Try a sample</LinkButton> or <LinkButton>a sample diff</LinkButton>
        </span>
        <LinkButton disabled>Disabled</LinkButton>
      </Group>

      <h3 className="gallery-component">Notice</h3>
      <Group title="Info and warn, which look the same today (in a box, not announced by itself)">
        <Notice tone="info">There are no comments yet, so there is nothing to send.</Notice>
        <Notice tone="warn">This suggestion overlaps the suggestion of another comment.</Notice>
      </Group>

      <h3 className="gallery-component">LiveStatus</h3>
      <Group title="A region that is announced when its text changes (the gallery draws the text, so that you can see it)">
        <Button size="sm" onClick={() => setSaid(said === null ? 'Saved at 10:42.' : null)}>
          {said === null ? 'Say something' : 'Clear'}
        </Button>
        <LiveStatus>{said}</LiveStatus>
      </Group>

      <h3 className="gallery-component">TextField</h3>
      <Group title="With a label and a hint, with its label hidden, in the code variant, and disabled">
        <TextField className="gallery-wide" label="Suggested implementation" hint="replaces the selected lines" rows={2} defaultValue="const x = 1" />
        <TextField className="gallery-wide" label="Comment" labelHidden rows={2} placeholder="Leave a comment on these lines…" />
        <TextField className="gallery-wide" label="Code" variant="code" hint="in the code variant" rows={3} defaultValue={'function add(a, b) {\n  return a + b\n}'} spellCheck={false} />
        <TextField className="gallery-wide" label="Disabled" rows={2} defaultValue="Not editable" disabled />
      </Group>

      <h3 className="gallery-component">Select</h3>
      <Group title="With its label drawn, with its label hidden, and disabled">
        <Select label="Language" defaultValue="ts">
          <option value="text">Plain text</option>
          <option value="ts">TypeScript</option>
          <option value="py">Python</option>
        </Select>
        <Select label="Language" labelHidden defaultValue="ts">
          <option value="text">Plain text</option>
          <option value="ts">TypeScript</option>
          <option value="py">Python</option>
        </Select>
        <Select label="Language" labelHidden disabled defaultValue="ts">
          <option value="ts">TypeScript, disabled</option>
        </Select>
      </Group>
    </>
  )
}

function Scheme({ scheme }: { scheme: 'light' | 'dark' }) {
  return (
    <div className="gallery-scheme" data-scheme={scheme}>
      <h2>{scheme === 'light' ? 'Light' : 'Dark'}</h2>
      <h3 className="gallery-component">Button</h3>
      <ButtonStates />
      <PrimitiveStates />
    </div>
  )
}

export function Gallery() {
  return (
    <main className="gallery">
      <header className="gallery-head">
        <h1>Component gallery</h1>
        <p className="muted">
          Every component in every state, light and dark side by side. Hover, focus and press work on the real components: use the mouse and Tab.
        </p>
      </header>
      <Scheme scheme="light" />
      <Scheme scheme="dark" />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
