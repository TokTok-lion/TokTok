import Image from 'next/image';
import { art, type ArtKey } from '@/lib/art';

type Props = {
  /** key into the generated manifest — typo-proof */
  name: ArtKey;
  /** rendered width in CSS px; height follows the asset's aspect ratio */
  size: number;
  /**
   * Decorative artwork gets alt="" so screen readers skip it (NFR-A11Y-006).
   * Pass alt only when the image carries meaning the text does not.
   */
  alt?: string;
  className?: string;
  priority?: boolean;
};

/**
 * Renders one of the 76 hand-drawn illustrations from the design deck.
 * Width is authoritative; height is derived so nothing is ever squashed.
 */
export function Art({ name, size, alt = '', className, priority }: Props) {
  const a = art[name];
  return (
    <Image
      src={a.src}
      alt={alt}
      // intrinsic dimensions keep the aspect ratio exact; CSS does the sizing
      width={a.width}
      height={a.height}
      className={className}
      priority={priority}
      // Art renders row glyphs and avatars — a few KB each, and always part of
      // the layout the moment the screen appears. Lazy-loading them makes the
      // icons pop in one by one, which reads as the screen glitching. The big
      // scene artwork uses ArtBox and stays lazy.
      loading={priority ? undefined : 'eager'}
      style={{ width: size, height: 'auto' }}
      aria-hidden={alt === '' ? true : undefined}
    />
  );
}

/**
 * Artwork that fills a fixed box (album art, memory cards, photos).
 * `cover` crops, `contain` letterboxes.
 */
export function ArtBox({
  name,
  alt = '',
  className,
  fit = 'cover',
  priority,
}: {
  name: ArtKey;
  alt?: string;
  className?: string;
  fit?: 'cover' | 'contain';
  priority?: boolean;
}) {
  const a = art[name];
  return (
    <Image
      src={a.src}
      alt={alt}
      width={a.width}
      height={a.height}
      priority={priority}
      className={className}
      style={{ objectFit: fit }}
      aria-hidden={alt === '' ? true : undefined}
    />
  );
}
