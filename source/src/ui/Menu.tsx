import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import { IconCheck } from './icons.tsx'
import { menuStep } from './menu-keys.ts'
import { menuSide } from './menu-side.ts'
import './menu.css'

/** What an item asks of the menu that holds it: to close, and to hand the focus back to its button. */
const MenuContext = createContext<{ close: () => void }>({ close: () => {} })

const ITEMS = '[role^="menuitem"]'

export interface MenuProps {
  /** What the button is called, in the caller's words: its accessible name and its tooltip. The button has an icon and no text. */
  label: string
  /** The icon of the button, one of the library's. */
  icon: ReactNode
  /** The edge of the button that the list lines up with when there is room: `end` for a button near the right edge of a bar. When there is not, the list takes the other edge. */
  align?: 'start' | 'end'
  /** Drawn open when it first appears, without taking the focus: for the gallery and nothing else. */
  defaultOpen?: boolean
  /** Layout only, such as a place in a bar. Never the look. */
  className?: string
  /** `MenuItem`, `MenuGroup` with `MenuRadioItem`, and `MenuSeparator`. */
  children: ReactNode
}

/**
 * A button that opens a list of actions over the page, for actions that a bar has no room to show all the time. It is the menu button pattern: the button says that
 * it opens a menu and whether it is open, the list is a `menu`, and the focus is on the items while it is open. The down and up arrows, Home and End move
 * between the items; Enter and Space choose; Escape closes it and puts the focus back on the button; a press outside, or Tab, closes it. Choosing an item closes
 * it too, and then does what the item does. Every string is the caller's.
 */
export function Menu({ label, icon, align = 'end', defaultOpen = false, className, children }: MenuProps) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const focusFirst = useRef(false)
  const [side, setSide] = useState(align)

  const items = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])
  const show = () => {
    focusFirst.current = true
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  // The list is drawn, and before it is seen it takes the edge of the button that keeps it on the screen; and again when the window is resized while it is open.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      if (!buttonRef.current || !listRef.current) return
      const button = buttonRef.current.getBoundingClientRect()
      setSide(menuSide(align, button.left, button.right, listRef.current.offsetWidth, document.documentElement.clientWidth))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, align])

  useEffect(() => {
    if (!open) return
    if (focusFirst.current) {
      focusFirst.current = false
      listRef.current?.querySelector<HTMLElement>(ITEMS)?.focus()
    }
    const onPress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPress)
    return () => document.removeEventListener('pointerdown', onPress)
  }, [open])

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (!open) show()
    else items()[0]?.focus()
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation() // the page's own Escape (a selection, a comment being written) is not for this
      close()
      return
    }
    if (event.key === 'Tab') {
      setOpen(false) // the focus goes on to what comes next
      return
    }
    const list = items()
    const next = menuStep(event.key, list.indexOf(document.activeElement as HTMLElement), list.length)
    if (next !== null) {
      event.preventDefault()
      list[next]?.focus()
    }
  }

  return (
    <div ref={rootRef} className={['jared-menu', className].filter(Boolean).join(' ')}>
      <Button
        ref={buttonRef}
        iconOnly
        icon={icon}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKeyDown}
      />
      {open && (
        <MenuContext.Provider value={{ close }}>
          <div ref={listRef} id={id} role="menu" aria-label={label} className="jared-menu-list" data-align={side} onKeyDown={onListKeyDown}>
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </div>
  )
}

export interface MenuItemProps {
  /** A decorative icon before the words, one of the library's. */
  icon?: ReactNode
  /** What the item does. The menu has closed, and the focus is back on its button, when it is called. */
  onSelect: () => void
  children: ReactNode
}

/** An action in a menu. */
export function MenuItem({ icon, onSelect, children }: MenuItemProps) {
  const { close } = useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className="jared-menu-item"
      onClick={() => {
        close()
        onSelect()
      }}
    >
      <span className="jared-menu-mark" aria-hidden="true">
        {icon}
      </span>
      {children}
    </button>
  )
}

export interface MenuRadioItemProps {
  /** Whether this is the choice that is on: it is drawn with a check and announced as checked. */
  checked: boolean
  /** Called when the reviewer chooses it, also when it is on already. */
  onSelect: () => void
  children: ReactNode
}

/** One choice of several in a menu: put them in a `MenuGroup`. */
export function MenuRadioItem({ checked, onSelect, children }: MenuRadioItemProps) {
  const { close } = useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      className="jared-menu-item"
      onClick={() => {
        close()
        onSelect()
      }}
    >
      <span className="jared-menu-mark" aria-hidden="true">
        {checked && <IconCheck />}
      </span>
      {children}
    </button>
  )
}

/** A set of items under a heading, such as the choices of one setting. The heading names the group for a screen reader. */
export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id}>
      <div id={id} className="jared-menu-label">
        {label}
      </div>
      {children}
    </div>
  )
}

/** A line between two sets of items. */
export function MenuSeparator() {
  return <div role="separator" className="jared-menu-separator" />
}
