import type { ReactNode } from 'react'

/**
 * All of these icons but the trash can follow the shapes of icons of Feather (MIT) and Lucide (ISC), which are credited in
 * THIRD-PARTY-NOTICES.md of the published plugin. The page's own icon, `public/favicon.svg`, uses the shape of Feather's `code`.
 */
function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconPlus = () => (
  <Svg size={14}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconX = () => (
  <Svg>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)
export const IconTrash = () => (
  <Svg>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </Svg>
)
export const IconPencil = () => (
  <Svg>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
)
export const IconUpload = ({ size = 16 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </Svg>
)
export const IconDownload = () => (
  <Svg>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </Svg>
)
export const IconCopy = () => (
  <Svg>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
)
export const IconMessage = () => (
  <Svg>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
)
export const IconPanel = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M15 3v18" />
  </Svg>
)
export const IconCheck = () => (
  <Svg>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)
export const IconSend = () => (
  <Svg>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Svg>
)
export const IconFile = () => (
  <Svg>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </Svg>
)
export const IconBrand = () => (
  <Svg size={18}>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </Svg>
)
export const IconSun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Svg>
)
export const IconMoon = () => (
  <Svg>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
)
export const IconMonitor = () => (
  <Svg>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
)

