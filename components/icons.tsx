import type { SVGProps } from 'react';

/* Line icons drawn to match the deck. Stroke-based so they inherit
   `currentColor` and stay crisp at any text-scale setting. */

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 10.4 12 3.5l9 6.9" />
    <path d="M5.5 9.6V20h13V9.6" />
  </Svg>
);

export const IconPeople = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.2 19.4c0-3.2 2.6-5.2 5.8-5.2s5.8 2 5.8 5.2" />
    <path d="M16.4 5.2a3 3 0 0 1 0 5.9" />
    <path d="M17.6 14.5c2.1.5 3.5 2.1 3.5 4.4" />
  </Svg>
);

export const IconContent = (p: P) => (
  <Svg {...p}>
    <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3.4" />
    <path d="M10.4 9.6 15 12l-4.6 2.4Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M12 6.4C10.3 5.1 8.4 4.5 6 4.5H3.6v13.6H6c2.4 0 4.3.6 6 1.9" />
    <path d="M12 6.4c1.7-1.3 3.6-1.9 6-1.9h2.4v13.6H18c-2.4 0-4.3.6-6 1.9" />
    <path d="M12 6.4v13.6" />
  </Svg>
);

export const IconMore = (p: P) => (
  <Svg {...p}>
    <circle cx="5.4" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="18.6" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6.3 10.3a5.7 5.7 0 0 1 11.4 0c0 4 1.3 5.4 1.9 6H4.4c.6-.6 1.9-2 1.9-6Z" />
    <path d="M10.2 19.4a2 2 0 0 0 3.6 0" />
  </Svg>
);

export const IconBack = (p: P) => (
  <Svg strokeWidth="2.6" {...p}>
    <path d="M14.5 5 8 12l6.5 7" />
  </Svg>
);

export const IconArrowLeft = (p: P) => (
  <Svg strokeWidth="2.4" {...p}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Svg>
);

export const IconMenu = (p: P) => (
  <Svg strokeWidth="2.4" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.2 2" />
  </Svg>
);

export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="2.8" width="6" height="11" rx="3" />
    <path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0" />
    <path d="M12 18v3.2" />
  </Svg>
);

export const IconPlay = ({ size = 24, ...rest }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
    <path d="M8 5.2 19 12 8 18.8Z" fill="currentColor" />
  </svg>
);

export const IconPause = ({ size = 24, ...rest }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
    <rect x="6.6" y="5" width="3.8" height="14" rx="1.6" fill="currentColor" />
    <rect x="13.6" y="5" width="3.8" height="14" rx="1.6" fill="currentColor" />
  </svg>
);

export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20.4 4v4.6h-4.6" />
  </Svg>
);

export const IconRewind = (p: P) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M3.6 4v4.6h4.6" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg strokeWidth="2.6" {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
);

export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M20.5 3.5 10.8 13.2" />
    <path d="M20.5 3.5 14.4 20.6l-3.6-7.4-7.4-3.6Z" />
  </Svg>
);

export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10.2 13.8a3.9 3.9 0 0 0 5.6 0l3-3a3.96 3.96 0 0 0-5.6-5.6l-1.5 1.5" />
    <path d="M13.8 10.2a3.9 3.9 0 0 0-5.6 0l-3 3a3.96 3.96 0 0 0 5.6 5.6l1.5-1.5" />
  </Svg>
);

export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M20.4 11.6c0 4-3.8 7.2-8.4 7.2a9.8 9.8 0 0 1-2.6-.3L4.6 20l1.2-3.6a6.9 6.9 0 0 1-2.2-4.8c0-4 3.8-7.2 8.4-7.2s8.4 3.2 8.4 7.2Z" />
  </Svg>
);

export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2.6" />
    <path d="M15.4 5.6a2 2 0 0 0-2-2H6.2a2.6 2.6 0 0 0-2.6 2.6v7.2a2 2 0 0 0 2 2" />
  </Svg>
);

export const IconExport = (p: P) => (
  <Svg {...p}>
    <path d="M12 15.4V3.8" />
    <path d="m7.6 8 4.4-4.2L16.4 8" />
    <path d="M4.4 15v3.6a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2V15" />
  </Svg>
);

export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4.2L19.3 8.9a2.4 2.4 0 0 0-3.4-3.4L4.8 16.6V20Z" />
    <path d="m14.6 6.8 3.4 3.4" />
  </Svg>
);

export const IconSave = (p: P) => (
  <Svg {...p}>
    <path d="M5.6 4.4h10.2L19.6 8v11.6a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19.6V6a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M7.8 4.4v5h7.2v-5" />
  </Svg>
);

export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 11.2v5.2" />
    <circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.2 5 5.9v5.3c0 4.3 2.9 7.6 7 9.6 4.1-2 7-5.3 7-9.6V5.9Z" />
    <path d="m9 12 2.2 2.2L15.4 10" />
  </Svg>
);

export const IconHeart = ({ size = 24, ...rest }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
    <path
      d="M12 20.4S3.6 15.3 3.6 9.6a4.6 4.6 0 0 1 8.4-2.6 4.6 4.6 0 0 1 8.4 2.6c0 5.7-8.4 10.8-8.4 10.8Z"
      fill="currentColor"
    />
  </svg>
);

export const IconQuestion = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.7" />
    <circle cx="12" cy="16.8" r="1.05" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconMinus = (p: P) => (
  <Svg strokeWidth="2.8" {...p}>
    <path d="M6 12h12" />
  </Svg>
);

export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.8" />
    <path d="M3.6 10h16.8M8.4 3.4v3.6M15.6 3.4v3.6" />
  </Svg>
);

export const IconSmile = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0" />
    <circle cx="9.3" cy="9.9" r="1" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="9.9" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconLeaf = (p: P) => (
  <Svg {...p}>
    <path d="M20 4c0 8.3-4.3 12.6-10.6 12.6A5.4 5.4 0 0 1 4 11.2C4 6.4 9.5 4 20 4Z" />
    <path d="M4.6 19.4C7 15.5 10.7 12.4 15 10.6" />
  </Svg>
);

export const IconBulb = (p: P) => (
  <Svg {...p}>
    <path d="M9.4 17.6a6.4 6.4 0 1 1 5.2 0" />
    <path d="M9.6 20.4h4.8" />
  </Svg>
);

export const IconDoc = (p: P) => (
  <Svg {...p}>
    <path d="M13.4 3.6H7a2 2 0 0 0-2 2v12.8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.2Z" />
    <path d="M13.4 3.6v5.6H19" />
  </Svg>
);

export const IconMusicNote = ({ size = 24, ...rest }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
    <path
      d="M19 4.2 9.4 6.4v9.1a3.1 3.1 0 1 0 1.9 2.8V9.1l6-1.4v5.6a3.1 3.1 0 1 0 1.7 2.7Z"
      fill="currentColor"
    />
  </svg>
);

export const IconGift = (p: P) => (
  <Svg {...p}>
    <rect x="3.6" y="9.4" width="16.8" height="11" rx="2" />
    <path d="M3.6 13.4h16.8M12 9.4v11" />
    <path d="M12 9.4S10.6 4 8.2 4a2.2 2.2 0 0 0 0 5.4M12 9.4S13.4 4 15.8 4a2.2 2.2 0 0 1 0 5.4" />
  </Svg>
);

export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3.4" y="4.8" width="17.2" height="14.4" rx="2.6" />
    <circle cx="8.8" cy="10" r="1.6" />
    <path d="m4.4 17.2 4.8-4.4 3.6 3.2 3-2.6 4.6 4" />
  </Svg>
);

export const IconSkip = (p: P) => (
  <Svg {...p}>
    <path d="M5.4 6.2 13 12l-7.6 5.8Z" fill="currentColor" />
    <path d="M17.4 5.6v12.8" />
  </Svg>
);

export const IconHeadset = (p: P) => (
  <Svg {...p}>
    <path d="M4.4 15.4v-3a7.6 7.6 0 0 1 15.2 0v3" />
    <rect x="2.8" y="13.6" width="4.2" height="6.2" rx="2.1" />
    <rect x="17" y="13.6" width="4.2" height="6.2" rx="2.1" />
  </Svg>
);
