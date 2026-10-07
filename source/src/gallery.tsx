import { StrictMode, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import * as ui from './ui'
import { Alert, Badge, Button, Card, CardBody, CardFoot, CardHead, Dialog, DialogFoot, Disclosure, FloatingToolbar, IconButton, IconMessage, IconMore, IconPencil, IconPlus, IconSend, IconTrash, IconUpload, IconX, Kbd, LinkButton, LiveStatus, Menu, MenuGroup, MenuItem, MenuRadioItem, MenuSeparator, Notice, Select, SegmentedControl, TextField, type SegmentedOption } from './ui'
import './styles.css'
import './gallery.css'

/**
 * The gallery of the component library: every component in every state, the light scheme and the dark one side by side, so that a change to
 * a component is seen in all of them at once. A page of the dev server (`gallery.html`; the production build does not include it), which imports the library and the stylesheet and nothing
 * else of the app. Hover, focus and press are live: use the mouse and Tab. Every string here is this page's own: the library holds no English.
 */

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
        <Button icon={<IconPlus />}>Open…</Button>
        <Button variant="primary" icon={<IconPlus />}>
          Submit review
        </Button>
        <Button size="sm" variant="primary" icon={<IconPlus />}>
          Comment
        </Button>
      </Group>
      <Group title="Icon only">
        <Button iconOnly icon={<IconPlus />} aria-label="Colour scheme: system" title="Colour scheme: system" />
        <Button iconOnly variant="ghost" icon={<IconPlus />} aria-label="Add" />
      </Group>
      <Group title="Pressed (a toggle): off, on, and one that you can press (hover over the one that is on: it stays on and its border thickens)">
        <Button pressed={false} icon={<IconPlus />}>
          Off
        </Button>
        <Button pressed icon={<IconPlus />}>
          On
        </Button>
        <Button pressed={on} icon={<IconPlus />} onClick={() => setOn(!on)}>
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

const FORMATS: readonly SegmentedOption<'md' | 'json'>[] = [
  { value: 'md', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
]
const SIZES: readonly SegmentedOption<'s' | 'm' | 'l'>[] = [
  { value: 's', label: 'Small' },
  { value: 'm', label: 'A medium choice with a longer name' },
  { value: 'l', label: 'Large' },
]

function PrimitiveStates() {
  const [said, setSaid] = useState<string | null>(null)
  const [format, setFormat] = useState<'md' | 'json'>('md')
  const [size, setSize] = useState<'s' | 'm' | 'l'>('m')
  return (
    <>
      <h3 className="gallery-component">Kbd</h3>
      <Group title="A key hint, in a line of text and in a button">
        <span>
          Press <Kbd>C</Kbd> to comment, <Kbd>Esc</Kbd> to cancel
        </span>
        <Button variant="primary" size="sm" icon={<IconPlus />}>
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
      <Group title="With the plain label of a dialog: bold words in the text colour, and the hint at the end of the row">
        <TextField className="gallery-wide" label="Overall summary" labelStyle="plain" hint="optional" rows={2} placeholder="Say what you think of the whole change…" />
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

      <h3 className="gallery-component">SegmentedControl</h3>
      <Group title="A choice of two, and a choice of three with one long word in it (use the arrow keys: the radio inside is hidden and the ring shows on the word)">
        <SegmentedControl label="Format" options={FORMATS} value={format} onChange={setFormat} />
        <SegmentedControl label="Size" options={SIZES} value={size} onChange={setSize} />
      </Group>
    </>
  )
}

function ComponentStates() {
  const [message, setMessage] = useState<string | null>('Review sent to Claude.')
  const [shown, setShown] = useState(true)
  const [modal, setModal] = useState(false)
  const [scheme, setScheme] = useState<'system' | 'light' | 'dark'>('system')
  const [chosen, setChosen] = useState('nothing yet')
  return (
    <>
      <h3 className="gallery-component">IconButton</h3>
      <Group title="Resting, with a tooltip, disabled, and in a bar (hover shows its background; 28 px, and 44 px under a finger)">
        <IconButton label="Delete comment" icon={<IconTrash />} />
        <IconButton label="Edit comment" title="Edit" icon={<IconPencil />} />
        <IconButton label="Clear selection" icon={<IconX />} disabled />
        <span className="gallery-bar">
          <span className="muted">Lines 3–5</span>
          <IconButton label="Edit comment" icon={<IconPencil />} />
          <IconButton label="Delete comment" icon={<IconTrash />} />
        </span>
      </Group>

      <h3 className="gallery-component">Badge</h3>
      <Group title="Chip: neutral, accent and ok">
        <Badge>Lines 3–5</Badge>
        <Badge tone="accent">Lines 3–5</Badge>
        <Badge tone="ok">± suggestion</Badge>
      </Group>
      <Group title="Chip with a long label, which takes a second line and stays round">
        <Badge className="gallery-narrow">src/components/SomeVeryLongComponentName.tsx · new lines 220–238</Badge>
      </Group>
      <Group title="Status: neutral, ok and warn, and one that is too long for its room (it ends in an ellipsis)">
        <Badge variant="status">Draft</Badge>
        <Badge variant="status" tone="ok">Exported at 10:42</Badge>
        <Badge variant="status" tone="warn">Edited since sent</Badge>
        <Badge variant="status" className="gallery-narrow" title="Waiting for Claude to pick the review up from the receiver">
          Waiting for Claude to pick the review up from the receiver
        </Badge>
      </Group>
      <Group title="Count: one, two and three digits, and inside a button that is on">
        <Badge variant="count">1</Badge>
        <Badge variant="count">12</Badge>
        <Badge variant="count">128</Badge>
        <Button pressed icon={<IconPlus />}>
          <Badge variant="count">3</Badge>
        </Button>
      </Group>

      <h3 className="gallery-component">Alert</h3>
      <Group title="Warn, error and ok, each with a cross that takes it away (press it: the live region stays, empty)">
        <div className="gallery-alerts">
          {shown && (
            <>
              <Alert tone="warn" dismissLabel="Dismiss" onDismiss={() => setShown(false)}>
                Your changes are not being saved in this browser.
              </Alert>
              <Alert tone="error" dismissLabel="Dismiss" onDismiss={() => setShown(false)}>
                That link could not be opened.
              </Alert>
            </>
          )}
          {!shown && <Button size="sm" className="gallery-start" onClick={() => setShown(true)}>
              Show the two again
            </Button>}
        </div>
      </Group>
      <Group title="Ok with an icon, its words set and cleared (the region is in the page before the words: it is announced when they arrive)">
        <div className="gallery-alerts">
          <Alert tone="ok" icon={<ui.IconCheck />} dismissLabel="Dismiss" onDismiss={() => setMessage(null)}>
            {message}
          </Alert>
          <Button size="sm" className="gallery-start" onClick={() => setMessage(message === null ? 'Review sent to Claude.' : null)}>
            {message === null ? 'Set the message' : 'Clear the message'}
          </Button>
        </div>
      </Group>
      <Group title="Without a cross, and with a file name that is one long word">
        <div className="gallery-alerts">
          <Alert tone="warn">Waiting for the receiver.</Alert>
          <Alert tone="error" dismissLabel="Dismiss" onDismiss={() => {}}>
            Could not open src/components/SomeVeryLongComponentNameThatDoesNotBreakAnywhereByItself.tsx
          </Alert>
        </div>
      </Group>

      <h3 className="gallery-component">Card</h3>
      <Group title="An article with a head, words and a foot, and one with only a head and words (the words keep their line breaks)">
        <div className="gallery-cards">
          <Card>
            <CardHead>
              <Badge>Lines 3–5</Badge>
              <span className="muted">12:01</span>
              <span className="spacer" />
              <IconButton label="Edit comment" icon={<IconPencil />} />
              <IconButton label="Delete comment" icon={<IconTrash />} />
            </CardHead>
            <CardBody>{'Why is this a constant?\nIt could be read from the settings.'}</CardBody>
            <CardFoot>
              <span className="spacer" />
              <Button size="sm">Keep</Button>
              <Button size="sm" variant="danger">
                Delete
              </Button>
            </CardFoot>
          </Card>
          <Card>
            <CardHead>
              <Badge tone="accent">Line 12</Badge>
              <span className="muted">12:02</span>
            </CardHead>
            <CardBody>ThisNameIsOneLongWordThatMustBreakInsteadOfMakingTheCardGrowSidewaysBecauseItDoesNotFitInTheRoom.tsx</CardBody>
          </Card>
        </div>
      </Group>
      <Group title="A form: a card that is written in (the foot's room is the caller's, as a layout class)">
        <div className="gallery-cards">
          <Card as="form" onSubmit={(event) => event.preventDefault()}>
            <CardHead>
              <Badge tone="accent">Lines 8–10</Badge>
              <span className="muted">Editing comment</span>
            </CardHead>
            <TextField className="gallery-card-field" label="Comment" labelHidden rows={2} defaultValue="Name the operand." />
            <CardFoot>
              <span className="spacer" />
              <Button>Cancel</Button>
              <Button type="submit" variant="primary">
                Update
              </Button>
            </CardFoot>
          </Card>
        </div>
      </Group>

      <h3 className="gallery-component">Disclosure</h3>
      <Group title="Closed, and open (the summary opens it, and so does the caller's `open`)">
        <div className="gallery-cards">
          <Disclosure summary="Other ways to export">
            <Button size="sm">Copy</Button>
            <Button size="sm">Download</Button>
          </Disclosure>
          <Disclosure summary="Other ways to export" open>
            <Button size="sm">Copy</Button>
            <Button size="sm">Download</Button>
            <span className="muted">Another way, with a long line of words that wraps under the buttons when the room is short.</span>
          </Disclosure>
        </div>
      </Group>

      <h3 className="gallery-component">Menu</h3>
      <Group title="A button that opens a list: press it, then use the arrow keys, Home, End, Enter, Escape, Tab and a press outside; the last choice is written beside it">
        <div className="gallery-menu">
          <span className="muted gallery-menu-said">Last chosen: {chosen}</span>
          <Menu label="More actions" icon={<IconMore />}>
            <MenuItem icon={<IconUpload />} onSelect={() => setChosen('Open…')}>
              Open…
            </MenuItem>
            <MenuSeparator />
            <MenuGroup label="Colour scheme">
              {(['system', 'light', 'dark'] as const).map((choice) => (
                <MenuRadioItem
                  key={choice}
                  checked={scheme === choice}
                  onSelect={() => {
                    setScheme(choice)
                    setChosen(`colour scheme ${choice}`)
                  }}
                >
                  {choice[0].toUpperCase() + choice.slice(1)}
                </MenuRadioItem>
              ))}
            </MenuGroup>
            <MenuSeparator />
            <MenuItem icon={<IconX />} onSelect={() => setChosen('Cancel review')}>
              Cancel review
            </MenuItem>
          </Menu>
        </div>
      </Group>
      <Group title="Drawn open, lined up with the end of its button as in a bar (the list is over the page, so the gallery leaves it room)">
        <div className="gallery-menu">
          <Menu label="More actions" icon={<IconMore />} defaultOpen>
            <MenuItem icon={<IconUpload />} onSelect={() => {}}>
              Open…
            </MenuItem>
            <MenuSeparator />
            <MenuGroup label="Colour scheme">
              <MenuRadioItem checked={false} onSelect={() => {}}>
                System
              </MenuRadioItem>
              <MenuRadioItem checked onSelect={() => {}}>
                Light
              </MenuRadioItem>
              <MenuRadioItem checked={false} onSelect={() => {}}>
                Dark
              </MenuRadioItem>
            </MenuGroup>
            <MenuSeparator />
            <MenuItem icon={<IconX />} onSelect={() => {}}>
              Cancel review
            </MenuItem>
          </Menu>
        </div>
      </Group>

      <h3 className="gallery-component">FloatingToolbar</h3>
      <Group title="A bar of controls in a pill (placed in the flow here: where it floats is the caller's), and one whose words take a second line (it stays round)">
        <div className="gallery-cards">
          <FloatingToolbar label="Selection actions" className="gallery-start">
            <span className="selbar-label">Lines 3–5</span>
            <Button variant="primary" size="sm" icon={<IconMessage />}>
              Comment <Kbd>C</Kbd>
            </Button>
            <IconButton label="Clear selection" icon={<IconX />} />
          </FloatingToolbar>
          <FloatingToolbar label="Selection actions" className="gallery-start gallery-toolbar-narrow">
            <span className="selbar-label">src/components/SomeVeryLongComponentName.tsx · new lines 220–238</span>
            <Button variant="primary" size="sm" icon={<IconMessage />}>
              Comment <Kbd>C</Kbd>
            </Button>
            <IconButton label="Clear selection" icon={<IconX />} />
          </FloatingToolbar>
        </div>
      </Group>

      <h3 className="gallery-component">Dialog</h3>
      <Group title="A modal, opened from a button (Esc, the cross and a press on the backdrop close it; the heading takes the focus)">
        <Button onClick={() => setModal(true)}>Open the dialog</Button>
        {modal && (
          <Dialog title="Send the review" subtitle="src/App.tsx · 3 comments" closeLabel="Close" closeTitle="Close (Esc)" onClose={() => setModal(false)}>
            <TextField label="Overall summary" labelStyle="plain" hint="optional" rows={3} placeholder="Say what you think of the whole change…" />
            <DialogFoot>
              <span className="muted">Not sent yet.</span>
              <Button variant="primary" icon={<IconSend />}>
                Send
              </Button>
            </DialogFoot>
          </Dialog>
        )}
      </Group>
      <Group title="As it is drawn, left in the flow of the page (modal is off, for this page and nothing else): a notice, a field, a choice, a foot and a disclosure">
        <Dialog modal={false} className="gallery-dialog" title="Send the review" subtitle="src/App.tsx · 3 comments" closeLabel="Close" closeTitle="Close (Esc)">
          <Notice tone="info">There are no comments yet, so there is nothing to send.</Notice>
          <TextField label="Overall summary" labelStyle="plain" hint="optional" rows={2} placeholder="Say what you think of the whole change…" />
          <div>
            <SegmentedControl label="Format" options={FORMATS} value="md" onChange={() => {}} />
          </div>
          <DialogFoot>
            <span className="muted">Review sent to Claude.</span>
            <Button variant="primary" icon={<IconSend />}>
              Send to Claude
            </Button>
          </DialogFoot>
          <Disclosure summary="Other ways to export">
            <Button size="sm">Copy</Button>
            <Button size="sm">Download</Button>
          </Disclosure>
        </Dialog>
      </Group>
      <Group title="With a heading that is one long word, and a foot whose words wrap">
        <Dialog modal={false} className="gallery-dialog" title="ThisHeadingIsOneLongWordThatBreaksInsteadOfMakingTheDialogGrowSideways.tsx" closeLabel="Close">
          <DialogFoot>
            <span className="muted">Could not reach the receiver at http://127.0.0.1:5173/some/long/path/that/does/not/break/by/itself</span>
            <Button variant="primary">Try again</Button>
          </DialogFoot>
        </Dialog>
      </Group>

      <h3 className="gallery-component">Icons</h3>
      <Group title="All seventeen, at their size (the trash can is the app's own; the others follow Feather and Lucide)">
        {Object.entries(ui)
          .filter(([name]) => /^Icon[A-Z]/.test(name) && name !== 'IconButton')
          .map(([name, Icon]) => {
            const Draw = Icon as React.ComponentType
            return (
              <span key={name} className="gallery-icon">
                <Draw />
                <span className="muted">{name}</span>
              </span>
            )
          })}
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
      <ComponentStates />
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
