import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import ScrollToPlugin from 'gsap/ScrollToPlugin'
import ScrollTrigger from 'gsap/ScrollTrigger'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type RefAttributes,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { apiUrl, netlifyUrl } from './config'
import { useTrackerFeed } from './useTrackerFeed'
import {
  useWatchlist,
  watchKey,
  type WatchEntry,
} from './useWatchlist'
import {
  BoltIcon as BoltSmallIcon,
  BookmarkIcon as BookmarkSmallIcon,
  ChartBarIcon as ChartBarSmallIcon,
  ChatBubbleLeftIcon as ChatBubbleSmallIcon,
  CheckBadgeIcon,
  EyeIcon as EyeSmallIcon,
} from '@heroicons/react/16/solid'
import {
  ArrowPathRoundedSquareIcon,
  ArrowUpRightIcon,
  ArrowUpTrayIcon,
  Bars3Icon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  BookmarkIcon,
  BellAlertIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  HashtagIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  UserGroupIcon,
} from '@heroicons-animated/react'

gsap.registerPlugin(useGSAP, ScrollToPlugin, ScrollTrigger)

function prefersMotion() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function ScrollText({
  as: Tag = 'p',
  text,
  className = '',
  delay = 0,
}: {
  as?: 'p' | 'h1' | 'h2' | 'h3'
  text: string
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el || !prefersMotion()) return
      const words = el.querySelectorAll<HTMLElement>('.scroll-word')
      if (!words.length) return

      gsap.from(words, {
        yPercent: 120,
        duration: 0.7,
        stagger: 0.045,
        ease: 'power3.out',
        delay,
      })
    },
    { scope: ref },
  )

  return (
    <Tag ref={ref as never} className={className}>
      {text.split(/(\s+)/).map((part, index) =>
        /^\s+$/.test(part) ? (
          <span key={index}>{part}</span>
        ) : (
          <span key={index} className="scroll-word-mask">
            <span className="scroll-word">{part}</span>
          </span>
        ),
      )}
    </Tag>
  )
}

type AnimHandle = {
  startAnimation: () => void
  stopAnimation: () => void
}

type AnimIcon = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<AnimHandle>
>

const LOOP_MS = 1800
const loopIcons = new Set<() => void>()
let loopTimer = 0
let loopRefs = 0

function playLoopIcons() {
  loopIcons.forEach((play) => play())
}

function retainLoopClock() {
  loopRefs += 1
  if (loopRefs !== 1 || !prefersMotion()) return
  loopTimer = window.setTimeout(() => {
    playLoopIcons()
    loopTimer = window.setInterval(playLoopIcons, LOOP_MS)
  }, 0)
}

function releaseLoopClock() {
  loopRefs -= 1
  if (loopRefs > 0) return
  window.clearTimeout(loopTimer)
  window.clearInterval(loopTimer)
  loopTimer = 0
}

function LiveIcon({
  icon: Icon,
  size = 20,
  className = '',
  loop = false,
}: {
  icon: AnimIcon
  size?: number
  className?: string
  loop?: boolean
}) {
  const iconRef = useRef<AnimHandle>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const play = () => iconRef.current?.startAnimation()
    const stop = () => iconRef.current?.stopAnimation()

    if (loop) {
      loopIcons.add(play)
      retainLoopClock()
      return () => {
        loopIcons.delete(play)
        releaseLoopClock()
      }
    }

    const hoverEl = wrap.closest('article, button, a, label') ?? wrap
    hoverEl.addEventListener('mouseenter', play)
    hoverEl.addEventListener('mouseleave', stop)

    if (!prefersMotion()) {
      return () => {
        hoverEl.removeEventListener('mouseenter', play)
        hoverEl.removeEventListener('mouseleave', stop)
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play()
      },
      { threshold: 0.45 },
    )
    io.observe(wrap)

    return () => {
      io.disconnect()
      hoverEl.removeEventListener('mouseenter', play)
      hoverEl.removeEventListener('mouseleave', stop)
    }
  }, [loop])

  return (
    <span ref={wrapRef} className={`inline-flex ${className}`}>
      <Icon ref={iconRef} size={size} />
    </span>
  )
}

function foldPanel(
  el: HTMLElement,
  open: boolean,
  extras: { marginBottom?: number; ease?: string; duration?: number } = {},
) {
  gsap.killTweensOf(el)
  gsap.to(el, {
    height: open ? 'auto' : 0,
    autoAlpha: open ? 1 : 0,
    marginBottom: open ? (extras.marginBottom ?? 0) : 0,
    duration: extras.duration ?? 0.7,
    ease: extras.ease ?? 'elastic.out(1.05, 0.48)',
    overwrite: 'auto',
  })
}

function AnimatedCheck({
  checked,
  onChange,
  children,
  className = '',
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 select-none ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className={`check-box ${checked ? 'is-on' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 16 16" className="size-3.5">
          <path
            className="check-mark"
            d="M3.2 8.2 6.6 11.4 12.8 4.4"
          />
        </svg>
      </span>
      {children}
    </label>
  )
}

function goTo(path: string) {
  if (window.location.pathname === path) {
    window.scrollTo(0, 0)
    return
  }
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return path
}

function scrollToHash(hash: string) {
  gsap.to(window, {
    duration: prefersMotion() ? 0.95 : 0,
    ease: 'power3.inOut',
    scrollTo: { y: hash, offsetY: 80, autoKill: true },
  })
}

function onNavClick(event: MouseEvent<HTMLAnchorElement>) {
  const href = event.currentTarget.getAttribute('href')
  if (!href) return

  if (href === '/use' || href === '/') {
    event.preventDefault()
    goTo(href)
    return
  }

  const hash = href.startsWith('#')
    ? href
    : href.includes('#')
      ? `#${href.split('#')[1]}`
      : null
  if (!hash) return
  event.preventDefault()
  if (window.location.pathname !== '/') {
    goTo('/')
    window.setTimeout(() => scrollToHash(hash), 80)
    return
  }
  scrollToHash(hash)
}

type Icon = AnimIcon

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#faq', label: 'FAQ' },
]

const liveFeed = [
  {
    handle: '@bonk_inu',
    name: 'BONK',
    ticker: '$BONK',
    time: '2m',
    tag: 'Call',
    badge: null,
    chain: 'Solana',
    avatar: '/api/avatar/bonk_inu',
    contract: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    body: 'KOLs stacking $BONK again. Volume just flipped the last local top. Replies are all “send CA” and bundle screenshots.',
    mentions: 640,
    replies: 412,
    reposts: '3.1k',
    likes: '18k',
    views: '1.2M',
  },
  {
    handle: '@blknoiz06',
    name: 'Ansem',
    ticker: '$BONK',
    time: '4m',
    tag: 'KOL',
    badge: 'blue' as const,
    chain: 'Solana',
    avatar: '/api/avatar/blknoiz06',
    contract: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    body: 'Seeing $BONK flow again. If you still need the CA it is in the quote. Do not ape the ticker.',
    mentions: 640,
    replies: 88,
    reposts: 210,
    likes: '4.1k',
    views: '92k',
  },
  {
    handle: '@muststopmurad',
    name: 'Murad',
    ticker: '$SPX',
    time: '6m',
    tag: 'KOL',
    badge: 'blue' as const,
    chain: 'ETH',
    avatar: '/api/avatar/muststopmurad',
    contract: '0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C',
    body: '184 mentions of $SPX in the last hour. Cult coin thread is moving. People posting the CA in quote tweets, not the ticker.',
    mentions: 184,
    replies: 96,
    reposts: 540,
    likes: '2.4k',
    views: '186k',
  },
  {
    handle: '@WizardOfSoHo',
    name: 'Wiz',
    ticker: '$SPX',
    time: '8m',
    tag: 'Call',
    badge: null,
    chain: 'ETH',
    avatar: '/api/avatar/WizardOfSoHo',
    contract: '0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C',
    body: '$SPX still the cleanest cult tape. CA in replies. If you are hunting a new ticker you are late to this one.',
    mentions: 184,
    replies: 41,
    reposts: 120,
    likes: 860,
    views: '28k',
  },
  {
    handle: '@a1lon9',
    name: 'Alon',
    ticker: '$PUMP',
    time: '11m',
    tag: 'Launch',
    badge: null,
    chain: 'Solana',
    avatar: '/api/avatar/a1lon9',
    contract: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    body: 'New $PUMP mention spike from EU wallets. 27 unreplied CA posts in the last hour. Bonding curve still open, snipers already in the replies.',
    mentions: 27,
    replies: 63,
    reposts: 18,
    likes: 214,
    views: '41k',
  },
]

function useMagneticFlair(
  buttonRef: RefObject<HTMLElement | null>,
  flairRef: RefObject<HTMLElement | null>,
) {
  useGSAP(
    () => {
      const button = buttonRef.current
      const flair = flairRef.current
      if (!button || !flair) return

      const xSet = gsap.quickSetter(flair, 'xPercent')
      const ySet = gsap.quickSetter(flair, 'yPercent')

      const getXY = (event: MouseEvent) => {
        const { left, top, width, height } = button.getBoundingClientRect()
        const xTransformer = gsap.utils.pipe(
          gsap.utils.mapRange(0, width, 0, 100),
          gsap.utils.clamp(0, 100),
        )
        const yTransformer = gsap.utils.pipe(
          gsap.utils.mapRange(0, height, 0, 100),
          gsap.utils.clamp(0, 100),
        )

        return {
          x: xTransformer(event.clientX - left),
          y: yTransformer(event.clientY - top),
        }
      }

      const onEnter = (event: MouseEvent) => {
        const { x, y } = getXY(event)
        xSet(x)
        ySet(y)
        gsap.to(flair, { scale: 1, duration: 0.4, ease: 'power2.out' })
      }

      const onLeave = (event: MouseEvent) => {
        const { x, y } = getXY(event)
        gsap.killTweensOf(flair)
        gsap.to(flair, {
          xPercent: x > 90 ? x + 20 : x < 10 ? x - 20 : x,
          yPercent: y > 90 ? y + 20 : y < 10 ? y - 20 : y,
          scale: 0,
          duration: 0.3,
          ease: 'power2.out',
        })
      }

      const onMove = (event: MouseEvent) => {
        const { x, y } = getXY(event)
        gsap.to(flair, {
          xPercent: x,
          yPercent: y,
          duration: 0.4,
          ease: 'power2',
        })
      }

      button.addEventListener('mouseenter', onEnter)
      button.addEventListener('mouseleave', onLeave)
      button.addEventListener('mousemove', onMove)

      return () => {
        button.removeEventListener('mouseenter', onEnter)
        button.removeEventListener('mouseleave', onLeave)
        button.removeEventListener('mousemove', onMove)
      }
    },
    { scope: buttonRef },
  )
}

function StartTrackingButton({
  href = '/use',
  children,
  onClick,
}: {
  href?: string
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const buttonRef = useRef<HTMLAnchorElement>(null)
  const flairRef = useRef<HTMLSpanElement>(null)
  useMagneticFlair(buttonRef, flairRef)

  return (
    <a
      ref={buttonRef}
      href={href}
      className="gsap-btn"
      onClick={(event) => {
        onClick?.(event)
        onNavClick(event)
      }}
    >
      <span ref={flairRef} className="gsap-btn__flair" />
      <span className="gsap-btn__label">
        {children}
        <LiveIcon icon={ArrowUpRightIcon} size={16} />
      </span>
    </a>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="reveal mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-14 text-sm sm:grid-cols-4">
        <div>
          <p className="inline-flex items-center gap-2 font-semibold">
            <LiveIcon icon={SignalIcon} size={16} loop />
            Trackr
          </p>
          <p className="mt-3 leading-relaxed text-neutral-500">
            A memecoin X tracker for degens who need the CA, not the scroll.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-neutral-400">
          <p className="font-medium text-neutral-100">Product</p>
          <a href="#features" onClick={onNavClick} className="hover:text-neutral-100">
            Features
          </a>
          <a href="#how" onClick={onNavClick} className="hover:text-neutral-100">
            How it works
          </a>
        </div>
        <div className="flex flex-col gap-2 text-neutral-400">
          <p className="font-medium text-neutral-100">Company</p>
          <a href="#faq" onClick={onNavClick} className="hover:text-neutral-100">
            FAQ
          </a>
          <a href="/" onClick={onNavClick} className="hover:text-neutral-100">
            Home
          </a>
        </div>
        <div className="flex flex-col gap-2 text-neutral-400">
          <p className="font-medium text-neutral-100">Social</p>
          <p>X</p>
          <p>Telegram</p>
          <p>© 2026 Trackr</p>
        </div>
      </div>
    </footer>
  )
}

function SiteHeader() {
  const path = usePath()
  const veilRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const ready = useRef<boolean | null>(null)
  const [open, setOpen] = useState(false)

  useGSAP(
    () => {
      const veil = veilRef.current
      const panel = panelRef.current
      if (!veil || !panel) return

      if (ready.current === null) {
        ready.current = open
        gsap.set(veil, { autoAlpha: 0 })
        gsap.set(panel, { xPercent: 100 })
        return
      }

      if (ready.current === open) return
      ready.current = open
      gsap.to(veil, { autoAlpha: open ? 1 : 0, duration: 0.3, ease: 'power2.out' })
      gsap.to(panel, {
        xPercent: open ? 0 : 100,
        duration: 0.35,
        ease: 'power3.out',
      })
    },
    { dependencies: [open] },
  )

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  function onMobileNav(event: MouseEvent<HTMLAnchorElement>) {
    setOpen(false)
    onNavClick(event)
  }

  return (
    <>
    <header className="page-header sticky top-0 z-20 border-b border-white/5 bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <a
          href="/"
          onClick={onMobileNav}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <LiveIcon icon={SignalIcon} size={20} loop />
          Trackr
        </a>
        <nav className="hidden items-center gap-x-6 text-sm text-neutral-400 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={path === '/use' ? `/${link.href}` : link.href}
              onClick={onNavClick}
              className="hover:text-neutral-100"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <StartTrackingButton>Start tracking</StartTrackingButton>
        </div>
        <button
          type="button"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/8 bg-raised text-neutral-300 md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((current) => !current)}
        >
          <LiveIcon icon={open ? XMarkIcon : Bars3Icon} size={20} />
        </button>
      </div>
    </header>

      <div
        className={`fixed inset-0 z-40 md:hidden ${open ? '' : 'pointer-events-none'}`}
      >
        <button
          ref={veilRef}
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-black/55"
          onClick={() => setOpen(false)}
        />
        <aside
          ref={panelRef}
          className="absolute inset-y-0 right-0 flex w-[min(20rem,86vw)] flex-col border-l border-white/8 bg-surface px-5 py-5"
        >
          <div className="mb-8 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 font-semibold">
              <LiveIcon icon={SignalIcon} size={20} loop />
              Trackr
            </p>
            <button
              type="button"
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/8 bg-raised text-neutral-300"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <LiveIcon icon={XMarkIcon} size={20} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={path === '/use' ? `/${link.href}` : link.href}
                onClick={onMobileNav}
                className="rounded-xl px-2 py-3 text-neutral-300 hover:bg-white/[0.045] hover:text-neutral-100"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <StartTrackingButton onClick={() => setOpen(false)}>
            Start tracking
          </StartTrackingButton>
        </aside>
      </div>
    </>
  )
}

function ContractCopy({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const short = `${address.slice(0, 4)}…${address.slice(-4)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard can fail in insecure contexts */
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void copy()
      }}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/8 bg-raised px-3 py-1.5 font-mono text-xs text-neutral-400"
      aria-label={`Copy contract ${address}`}
    >
      <span>{short}</span>
      {copied ? (
        <LiveIcon icon={CheckIcon} size={16} />
      ) : (
        <LiveIcon icon={ClipboardDocumentIcon} size={16} />
      )}
      <span className="text-neutral-500">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function avatarUrl(handle: string) {
  const slug = handle.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '')
  return slug ? apiUrl(`/api/avatar/${slug}`) : ''
}

function resolveAvatarSrc(src?: string, handle?: string) {
  if (handle) return avatarUrl(handle)
  if (!src) return ''
  if (src.startsWith('/api/avatar/')) return apiUrl(src)
  if (src.startsWith('/pfps/')) {
    return avatarUrl(src.replace('/pfps/', '').replace(/\.\w+$/, ''))
  }
  const unavatar = src.match(/unavatar\.io\/(?:x\/|twitter\/)?([^/?]+)/i)
  if (unavatar?.[1]) return avatarUrl(unavatar[1])
  return src
}

function displayTicker(ticker: string) {
  const clean = ticker.replace(/[\u2060\u200b]/g, '').trim()
  if (clean.length <= 16) return clean
  return `${clean.slice(0, 12)}…`
}

function TimeAgo({
  createdAt,
  fallback,
  live = false,
}: {
  createdAt?: number
  fallback: string
  live?: boolean
}) {
  const [label, setLabel] = useState(() =>
    createdAt ? formatAge(createdAt) : fallback,
  )

  useEffect(() => {
    if (!createdAt) {
      setLabel(fallback)
      return
    }
    setLabel(formatAge(createdAt))
    const id = window.setInterval(() => setLabel(formatAge(createdAt)), 4000)
    return () => window.clearInterval(id)
  }, [createdAt, fallback])

  return <span className={live ? 'text-blurple' : 'text-neutral-500'}>{label}</span>
}

function formatAge(createdAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function VerifiedBadge({ badge }: { badge?: 'blue' | 'gold' | 'gray' | null }) {
  if (!badge) return null
  const color =
    badge === 'gold'
      ? 'text-[#e8b423]'
      : badge === 'gray'
        ? 'text-neutral-400'
        : 'text-[#1d9bf0]'
  return (
    <CheckBadgeIcon
      className={`size-4 shrink-0 ${color}`}
      title={badge === 'gold' ? 'Gold verified' : 'Verified'}
    />
  )
}

function TweetAvatar({
  src,
  name,
  handle,
  badge,
}: {
  src?: string
  name: string
  handle?: string
  badge?: 'blue' | 'gold' | 'gray' | null
}) {
  const resolved = resolveAvatarSrc(src, handle)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [resolved])

  return (
    <span className="relative size-10 shrink-0">
      {failed || !resolved ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-medium">
          {name.slice(0, 2)}
        </span>
      ) : (
        <img
          src={resolved}
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {badge ? (
        <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-page">
          <VerifiedBadge badge={badge} />
        </span>
      ) : null}
    </span>
  )
}

function FeedCard({
  handle,
  name,
  ticker,
  time,
  tag,
  chain,
  avatar,
  contract,
  body,
  replies,
  reposts,
  likes,
  views,
  showCa = true,
  live = false,
  badge,
}: (typeof liveFeed)[number] & { showCa?: boolean; live?: boolean }) {
  return (
    <div className="border-b border-white/8 last:border-b-0">
    <a
      href={`https://x.com/${handle.slice(1)}`}
      className="mx-1.5 my-1.5 block cursor-pointer rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.045]"
    >
      <div className="flex items-start gap-3">
        <TweetAvatar src={avatar} name={name} handle={handle} badge={badge} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-5">
            <p className="inline-flex min-w-0 items-center gap-1 font-semibold text-neutral-100">
              <span className="truncate">{name}</span>
              <VerifiedBadge badge={badge} />
            </p>
            <p className="truncate text-neutral-500">{handle}</p>
            <p className="text-neutral-400">·</p>
            <p className={live ? 'font-medium text-blurple' : 'text-neutral-500'}>
              {live ? 'now' : time}
            </p>
            {live && (
              <span className="rounded-full border border-blurple px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-blurple">
                Live
              </span>
            )}
            <span className="rounded-full bg-raised px-1.5 py-px text-[10px] text-neutral-400">
              {tag}
            </span>
            <span className="rounded-full bg-raised px-1.5 py-px text-[10px] text-neutral-400">
              {chain}
            </span>
            <span className="max-w-[8rem] truncate font-medium text-neutral-200">
              {displayTicker(ticker)}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">{body}</p>
          {showCa && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-neutral-500">CA</p>
              <ContractCopy address={contract} />
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <LiveIcon icon={ChatBubbleLeftIcon} size={14} />
              {replies}
            </span>
            <span className="inline-flex items-center gap-1">
              <LiveIcon icon={ArrowPathRoundedSquareIcon} size={14} />
              {reposts}
            </span>
            <span className="inline-flex items-center gap-1">
              <LiveIcon icon={HeartIcon} size={14} />
              {likes}
            </span>
            <span className="inline-flex items-center gap-1">
              <LiveIcon icon={ChartBarIcon} size={14} />
              {views}
            </span>
          </div>
        </div>
      </div>
    </a>
    </div>
  )
}

function WatchlistRow({
  ticker,
  name,
  chain,
  contract,
  mentions,
  avatar,
  onRemove,
}: WatchEntry & { onRemove: () => void }) {
  return (
    <div className="border-b border-white/8 last:border-b-0">
    <div className="mx-1.5 my-1.5 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.045]">
      <TweetAvatar
        src={avatar}
        name={name}
        handle={ticker.startsWith('@') ? ticker : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {ticker} <span className="font-normal text-neutral-500">{name}</span>
        </p>
        <p className="text-xs text-neutral-500">
          {chain} · {mentions}/hr
        </p>
      </div>
      {contract ? (
        <ContractCopy address={contract} />
      ) : (
        <span className="text-xs text-neutral-500">No CA</span>
      )}
      <button
        type="button"
        aria-label={`Remove ${ticker}`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onRemove()
        }}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-neutral-100"
      >
        <LiveIcon icon={TrashIcon} size={16} />
      </button>
    </div>
    </div>
  )
}

function LiveFeed({
  tweetsOnly = false,
  className = 'h-[30rem] rounded-2xl',
}: {
  tweetsOnly?: boolean
  className?: string
}) {
  const feedRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const pillFastRef = useRef<HTMLSpanElement>(null)
  const pillSlowRef = useRef<HTMLSpanElement>(null)
  const tweetsTabRef = useRef<HTMLButtonElement>(null)
  const watchTabRef = useRef<HTMLButtonElement>(null)
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const pillReady = useRef(false)
  const settingsFold = useRef<boolean | null>(null)
  const [tab, setTab] = useState<'tweets' | 'watchlist'>('tweets')
  const [tick, setTick] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState({
    chain: 'All',
    minMentions: '10',
    showCa: true,
    hideRugs: true,
    kolOnly: false,
  })
  const [importDraft, setImportDraft] = useState('')
  const [importNote, setImportNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { watchlist, addFromText, remove } = useWatchlist(liveFeed)

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 4200)
    return () => window.clearInterval(id)
  }, [])

  const visibleFeed = useMemo(() => {
    const filtered = liveFeed.filter((item) => {
      if (settings.chain !== 'All' && item.chain !== settings.chain) return false
      if (settings.kolOnly && item.tag !== 'KOL') return false
      if (item.mentions < Number(settings.minMentions || 0)) return false
      return true
    })
    if (filtered.length === 0) return filtered
    const offset = tick % filtered.length
    return [...filtered.slice(offset), ...filtered.slice(0, offset)]
  }, [settings, tick])

  function applyImport(text: string) {
    const result = addFromText(text)
    setImportNote(result.note)
  }

  function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void file.text().then(applyImport)
  }

  useGSAP(
    () => {
      gsap.to('.feed-pulse', {
        opacity: 0.25,
        duration: 0.9,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      })
    },
    { scope: feedRef },
  )

  useGSAP(
    () => {
      if (tweetsOnly) return
      const container = tabsRef.current
      const fast = pillFastRef.current
      const slow = pillSlowRef.current
      const active = tab === 'tweets' ? tweetsTabRef.current : watchTabRef.current
      if (!container || !fast || !slow || !active) return

      const box = container.getBoundingClientRect()
      const target = active.getBoundingClientRect()
      const next = {
        x: target.left - box.left,
        y: target.top - box.top,
        width: target.width,
        height: target.height,
      }

      if (!pillReady.current) {
        gsap.set([fast, slow], next)
        pillReady.current = true
        return
      }

      gsap.killTweensOf([fast, slow])
      gsap.to(fast, {
        ...next,
        duration: 0.38,
        ease: 'expo.out',
      })
      gsap.to(slow, {
        ...next,
        duration: 0.68,
        ease: 'power3.out',
      })
    },
    { scope: feedRef, dependencies: [tab, tweetsOnly] },
  )

  useGSAP(
    () => {
      if (tweetsOnly) return
      const wrap = settingsWrapRef.current
      if (!wrap) return

      if (settingsFold.current === null) {
        settingsFold.current = settingsOpen
        gsap.set(wrap, { height: 0, autoAlpha: 0, marginBottom: 0 })
        return
      }

      if (settingsFold.current === settingsOpen) return
      settingsFold.current = settingsOpen
      foldPanel(wrap, settingsOpen, { marginBottom: 12, ease: 'power3.out', duration: 0.35 })
    },
    { scope: feedRef, dependencies: [settingsOpen, tweetsOnly] },
  )

  return (
    <div ref={feedRef} className={`panel flex flex-col overflow-hidden ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <LiveIcon icon={SignalIcon} size={16} loop />
          Trackr
        </p>
        {tweetsOnly && (
          <p className="inline-flex items-center gap-2 text-xs text-neutral-500">
            <span className="feed-pulse size-1.5 rounded-full bg-blurple" />
            Updating now
          </p>
        )}
      </div>
      {!tweetsOnly && (
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pt-3">
        <div
          ref={tabsRef}
          className="relative flex items-center rounded-full border border-white/8 bg-raised p-1.5 text-xs"
        >
          <svg width="0" height="0" className="absolute" aria-hidden="true">
            <defs>
              <filter id="tab-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feColorMatrix
                  in="blur"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                />
              </filter>
            </defs>
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ filter: 'url(#tab-goo)' }}
          >
            <span
              ref={pillSlowRef}
              className="absolute top-0 left-0 rounded-full bg-neutral-100"
            />
            <span
              ref={pillFastRef}
              className="absolute top-0 left-0 rounded-full bg-neutral-100"
            />
          </div>
          <button
            ref={tweetsTabRef}
            type="button"
            onClick={() => setTab('tweets')}
            className={`relative z-10 inline-flex h-8 w-[8.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 transition-colors duration-200 ${
              tab === 'tweets' ? 'text-neutral-950' : 'text-neutral-400'
            }`}
          >
            <BoltSmallIcon className="size-4" />
            CA Tweets
          </button>
          <button
            ref={watchTabRef}
            type="button"
            onClick={() => setTab('watchlist')}
            className={`relative z-10 inline-flex h-8 w-[8.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 transition-colors duration-200 ${
              tab === 'watchlist' ? 'text-neutral-950' : 'text-neutral-400'
            }`}
          >
            <EyeSmallIcon className="size-4" />
            Watchlist
          </button>
        </div>
        <div className="flex items-center gap-2">
          <p className="inline-flex items-center gap-2 text-xs text-neutral-500">
            <span className="feed-pulse size-1.5 rounded-full bg-blurple" />
            Updating now
          </p>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs ${
              settingsOpen
                ? 'border-neutral-100 bg-neutral-100 text-neutral-950'
                : 'border-white/8 bg-raised text-neutral-400'
            }`}
            aria-expanded={settingsOpen}
          >
            <LiveIcon icon={Cog6ToothIcon} size={16} />
            Settings
          </button>
        </div>
      </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
        {!tweetsOnly && (
        <div ref={settingsWrapRef} className="h-0 overflow-hidden opacity-0">
          <div className="grid shrink-0 gap-3 rounded-2xl border border-white/8 bg-raised p-3 text-sm sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-neutral-500">Chain</span>
              <select
                value={settings.chain}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, chain: event.target.value }))
                }
                className="rounded-full border border-white/8 bg-page px-3 py-1.5 outline-none focus:border-blurple"
              >
                <option>All</option>
                <option>Solana</option>
                <option>ETH</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-neutral-500">Min mentions / hour</span>
              <input
                type="number"
                min="0"
                value={settings.minMentions}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    minMentions: event.target.value,
                  }))
                }
                className="rounded-full border border-white/8 bg-page px-3 py-1.5 outline-none focus:border-blurple"
              />
            </label>
            <AnimatedCheck
              checked={settings.showCa}
              onChange={(showCa) => setSettings((current) => ({ ...current, showCa }))}
            >
              Show contract addresses
            </AnimatedCheck>
            <AnimatedCheck
              checked={settings.hideRugs}
              onChange={(hideRugs) => setSettings((current) => ({ ...current, hideRugs }))}
            >
              Hide suspected rugs
            </AnimatedCheck>
            <AnimatedCheck
              checked={settings.kolOnly}
              onChange={(kolOnly) => setSettings((current) => ({ ...current, kolOnly }))}
              className="sm:col-span-2"
            >
              KOL calls only
            </AnimatedCheck>
          </div>
        </div>
        )}

        {!tweetsOnly && tab === 'watchlist' && (
          <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
            <input
              value={importDraft}
              onChange={(event) => setImportDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                if (!importDraft.trim()) return
                applyImport(importDraft)
                setImportDraft('')
              }}
              placeholder="$WIF, @handle, or CA"
              className="min-w-0 flex-1 rounded-full border border-white/8 bg-raised px-3 py-1.5 text-sm outline-none focus:border-blurple"
            />
            <button
              type="button"
              onClick={() => {
                if (!importDraft.trim()) return
                applyImport(importDraft)
                setImportDraft('')
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/8 bg-raised px-3 py-1.5 text-xs text-neutral-300"
            >
              <LiveIcon icon={PlusIcon} size={16} />
              Add
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/8 bg-raised px-3 py-1.5 text-xs text-neutral-300"
            >
              <LiveIcon icon={ArrowUpTrayIcon} size={16} />
              {importNote || 'Import'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,.tsv,text/plain,text/csv"
              className="sr-only"
              onChange={onImportFile}
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tweetsOnly || tab === 'tweets'
            ? visibleFeed.map((item, index) => (
                <FeedCard
                  key={item.handle}
                  {...item}
                  showCa={settings.showCa}
                  live={index === 0}
                />
              ))
            : watchlist.length === 0
              ? (
                  <p className="px-3 py-6 text-sm text-neutral-500">
                    Nothing on the list. Add a ticker, handle, or CA.
                  </p>
                )
              : watchlist.map((item) => (
                <WatchlistRow
                  key={watchKey(item)}
                  ticker={item.ticker}
                  name={item.name}
                  chain={item.chain}
                  contract={item.contract}
                  mentions={item.mentions}
                  avatar={item.avatar}
                  onRemove={() => remove(item)}
                />
              ))}
        </div>
      </div>
    </div>
  )
}

function CountUp({
  to,
  decimals = 0,
  suffix = '',
  next,
  sep = '/',
  duration = 1.45,
}: {
  to: number
  decimals?: number
  suffix?: string
  next?: number
  sep?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useGSAP(() => {
    const el = ref.current
    if (!el) return

    const format = (value: number, other = 0) =>
      next === undefined
        ? `${value.toFixed(decimals)}${suffix}`
        : `${Math.round(value)}${sep}${Math.round(other)}`

    if (!prefersMotion()) {
      el.textContent = format(to, next)
      return
    }

    const state = { value: 0, other: 0 }
    el.textContent = format(0, 0)

    gsap.to(state, {
      value: to,
      other: next ?? 0,
      duration,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 90%',
        once: true,
      },
      onUpdate: () => {
        el.textContent = format(state.value, state.other)
      },
    })
  })

  return <span ref={ref} />
}

const howSteps = [
  {
    Icon: MagnifyingGlassIcon,
    step: '01',
    title: 'Add tickers & KOLs',
    body: 'Drop in $TICKER, a contract, or the accounts you already fade or follow.',
  },
  {
    Icon: Cog6ToothIcon,
    step: '02',
    title: 'Tune the feed',
    body: 'Filter by chain, min mentions, KOL-only, and hide suspected rugs.',
  },
  {
    Icon: ClipboardDocumentIcon,
    step: '03',
    title: 'Copy the CA',
    body: 'One click copies the contract. Jump to Photon, BullX, FOMO, or your wallet.',
  },
] satisfies { Icon: Icon; step: string; title: string; body: string }[]

function HowTimeline({ static: staticTimeline = false }: { static?: boolean }) {
  const listRef = useRef<HTMLOListElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const list = listRef.current
      const line = lineRef.current
      if (!list || !line) return

      if (staticTimeline || !prefersMotion()) {
        gsap.set(line, { scaleX: 1 })
        return
      }

      gsap.fromTo(
        line,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          transformOrigin: 'left center',
          scrollTrigger: {
            trigger: list,
            start: 'top 80%',
            end: 'top 42%',
            scrub: 0.45,
          },
        },
      )
    },
    { scope: listRef, dependencies: [staticTimeline] },
  )

  return (
    <ol
      ref={listRef}
      className={`relative mt-12 grid gap-8 sm:grid-cols-3 sm:gap-10 ${
        staticTimeline ? '' : 'reveal-stagger'
      }`}
    >
      <span
        aria-hidden
        className="absolute top-[18px] right-[18px] left-[18px] hidden h-0.5 bg-white/8 sm:block"
      />
      <span
        ref={lineRef}
        aria-hidden
        className={`absolute top-[18px] right-[18px] left-[18px] hidden h-0.5 origin-left bg-blurple sm:block ${
          staticTimeline ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
      {howSteps.map(({ Icon, step, title, body }) => (
        <li
          key={step}
          className={`relative flex flex-col ${staticTimeline ? '' : 'reveal-item'}`}
        >
          <span className="relative z-10 mb-5 inline-flex size-9 items-center justify-center rounded-full bg-raised text-blurple ring-1 ring-white/8">
            <LiveIcon icon={Icon} size={20} />
          </span>
          <p className="text-xs font-medium text-blurple">{step}</p>
          <h3 className="mt-1 font-medium">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">{body}</p>
        </li>
      ))}
    </ol>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const fold = useRef<boolean | null>(null)
  const [open, setOpen] = useState(false)

  useGSAP(
    () => {
      const body = bodyRef.current
      if (!body) return

      if (fold.current === null) {
        fold.current = open
        gsap.set(body, { height: 0, autoAlpha: 0 })
        return
      }

      if (fold.current === open) return
      fold.current = open
      foldPanel(body, open, { ease: 'power3.out', duration: 0.35 })
    },
    { dependencies: [open] },
  )

  return (
    <div className="px-5 py-5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left font-medium"
        aria-expanded={open}
      >
        {question}
        <LiveIcon
          icon={ChevronDownIcon}
          size={16}
          className={`shrink-0 text-neutral-500 transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div ref={bodyRef} className="h-0 overflow-hidden opacity-0">
        <p className="pt-3 text-sm leading-relaxed text-neutral-400">{answer}</p>
      </div>
    </div>
  )
}

function Key({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <kbd className={`shortcut-key ${className}`}>{children}</kbd>
}

function ShortcutHint({ className = '' }: { className?: string }) {
  return (
    <div className={`shortcut-hint text-base leading-relaxed text-neutral-400 ${className}`}>
      <p>
        If there's no bar, do{' '}
        <span className="shortcut-row">
          <Key>Ctrl</Key>
          <Key>Shift</Key>
          <Key>B</Key>
        </span>
      </p>
      <p className="mt-3">
        On Mac, do{' '}
        <span className="shortcut-row">
          <Key>⌘ Cmd</Key>
          <Key>Shift</Key>
          <Key>B</Key>
        </span>
      </p>
    </div>
  )
}

const CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.47 10.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 12.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M11.47 4.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 6.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z" clip-rule="evenodd"/></svg>'

function DragBookmarkOverlay() {
  const arrows = useMemo(
    () =>
      Array.from({ length: 56 }, (_, index) => ({
        id: index,
        left: `${(index * 17) % 100}%`,
        delay: `${(index % 12) * 0.35}s`,
        duration: `${5 + (index % 7) * 0.45}s`,
        size: `${14 + (index % 5) * 4}px`,
        opacity: 0.12 + (index % 6) * 0.04,
      })),
    [],
  )

  return createPortal(
    <div className="drag-hint">
      <div className="drag-hint__field" aria-hidden>
        {arrows.map((arrow) => (
          <span
            key={arrow.id}
            className="drag-hint__arrow"
            style={{
              left: arrow.left,
              animationDelay: arrow.delay,
              animationDuration: arrow.duration,
              width: arrow.size,
              height: arrow.size,
              opacity: arrow.opacity,
            }}
            dangerouslySetInnerHTML={{ __html: CHEVRON_SVG }}
          />
        ))}
      </div>
      <div className="drag-hint__copy">
        <p className="drag-hint__title">Drag to your bookmarks bar</p>
        <ShortcutHint className="drag-hint__keys" />
      </div>
    </div>,
    document.body,
  )
}

function buildFomoBookmarkUrl() {
  const appUrl = window.location.origin
  const runnerUrl = netlifyUrl()

  return fetch('/fomo-bookmarklet.js')
    .then((response) => response.text())
    .then((code) => {
      const bookmark = code
        .replaceAll('__APP_URL__', appUrl)
        .replaceAll('__NETLIFY_URL__', runnerUrl)
        .trim()
      return `javascript:${encodeURIComponent(bookmark)}`
    })
}

function DragTrackerButton() {
  const buttonRef = useRef<HTMLAnchorElement>(null)
  const spotRef = useRef<HTMLSpanElement>(null)
  const dragging = useRef(false)
  const [hinting, setHinting] = useState(false)

  useEffect(() => {
    buildFomoBookmarkUrl().then((url) => {
      if (buttonRef.current) buttonRef.current.href = url
    })
  }, [])

  useGSAP(
    () => {
      const button = buttonRef.current
      const spot = spotRef.current
      if (!button || !spot || !prefersMotion()) return

      function onMove(event: globalThis.MouseEvent) {
        const rect = button.getBoundingClientRect()
        spot.style.setProperty(
          '--spot-x',
          `${((event.clientX - rect.left) / rect.width) * 100}%`,
        )
        spot.style.setProperty(
          '--spot-y',
          `${((event.clientY - rect.top) / rect.height) * 100}%`,
        )
      }

      function onEnter() {
        gsap.to(spot, { opacity: 1, duration: 0.3, ease: 'power2.out' })
        gsap.to(button, {
          boxShadow: '0 12px 36px rgb(88 101 242 / 0.42)',
          duration: 0.35,
          ease: 'power2.out',
        })
      }

      function onLeave() {
        gsap.to(spot, { opacity: 0, duration: 0.28, ease: 'power2.out' })
        gsap.to(button, {
          boxShadow: '0 0 0 rgb(0 0 0 / 0)',
          duration: 0.3,
          ease: 'power2.out',
        })
      }

      button.addEventListener('mousemove', onMove)
      button.addEventListener('mouseenter', onEnter)
      button.addEventListener('mouseleave', onLeave)
      return () => {
        button.removeEventListener('mousemove', onMove)
        button.removeEventListener('mouseenter', onEnter)
        button.removeEventListener('mouseleave', onLeave)
      }
    },
    { scope: buttonRef },
  )

  function parkHover() {
    const button = buttonRef.current
    const spot = spotRef.current
    if (spot) {
      gsap.killTweensOf(spot)
      gsap.set(spot, { opacity: 0 })
    }
    if (button) {
      gsap.killTweensOf(button)
      gsap.set(button, { boxShadow: '0 0 0 rgb(0 0 0 / 0)' })
    }
  }

  function showHint() {
    setHinting(true)
  }

  function hideHint() {
    if (dragging.current) return
    setHinting(false)
  }

  function onDragStart(event: DragEvent<HTMLAnchorElement>) {
    const bookmarkUrl = buttonRef.current?.href
    if (!bookmarkUrl) return
    event.dataTransfer.setData('text/uri-list', bookmarkUrl)
    event.dataTransfer.setData('text/plain', bookmarkUrl)
    event.dataTransfer.effectAllowed = 'copy'
    dragging.current = true
    parkHover()
    setHinting(true)
  }

  function onDragEnd() {
    dragging.current = false
    setHinting(false)
  }

  return (
    <>
      <a
        ref={buttonRef}
        href="#"
        draggable
        onClick={(event) => event.preventDefault()}
        onPointerDown={showHint}
        onPointerUp={hideHint}
        onPointerCancel={hideHint}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="drag-tracker flex w-full items-center justify-center rounded-2xl bg-blurple px-6 py-6 text-center text-2xl font-semibold text-white"
      >
        <span ref={spotRef} className="drag-tracker__spot" />
        <span className="drag-tracker__label">Open twitter tracker</span>
      </a>
      {hinting ? <DragBookmarkOverlay /> : null}
    </>
  )
}

function UsePage() {
  useEffect(() => {
    document.title = 'Trackr — Install'
    return () => {
      document.title = 'Trackr — Memecoin X tracker'
    }
  }, [])

  return (
    <div className="bg-page font-sans text-neutral-100">
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12 lg:px-8 lg:py-16">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-blurple">Install</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              How to add Trackr
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-neutral-400">
              Drag the button to your bookmarks bar once. Run it on FOMO when you
              want the feed.
            </p>
          </div>

          <div className="mt-12 grid items-start gap-12 lg:mt-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)] lg:gap-16">
            <div className="relative">
              <div className="hero-glow" aria-hidden />
              <div className="relative">
                <LiveFeed tweetsOnly />
              </div>
            </div>
            <div className="flex flex-col">
              <DragTrackerButton />
              <ShortcutHint className="mt-6" />
            </div>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}

function Landing() {
  const pageRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!prefersMotion()) return

      gsap.from('.hero-copy > :not(h1)', {
        y: 18,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.08,
        delay: 0.22,
        ease: 'power3.out',
      })
      gsap.from('.hero-panel', {
        y: 22,
        autoAlpha: 0,
        duration: 0.8,
        delay: 0.1,
        ease: 'power3.out',
      })

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          y: 20,
          autoAlpha: 0,
          duration: 0.65,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          },
        })
      })

      gsap.utils.toArray<HTMLElement>('.reveal-stagger').forEach((group) => {
        gsap.from(group.querySelectorAll('.reveal-item'), {
          y: 16,
          autoAlpha: 0,
          duration: 0.55,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: group,
            start: 'top 86%',
            once: true,
          },
        })
      })

    },
    { scope: pageRef },
  )

  return (
    <div ref={pageRef} className="min-h-svh bg-page font-sans text-neutral-100">
      <SiteHeader />

      <main>
        <section
          id="top"
          className="mx-auto grid max-w-7xl scroll-mt-24 items-center gap-10 px-6 py-12 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.35fr)] lg:py-16"
        >
          <div className="hero-copy flex flex-col justify-center gap-6">
            <ScrollText
              as="h1"
              text="Catch the ticker, the CA, and the KOL call in one feed."
              className="text-4xl font-semibold tracking-tight md:text-6xl"
            />
            <p className="max-w-xl text-lg leading-relaxed text-neutral-400">
              Trackr watches X for memecoins: tickers, contract addresses, and
              influencer calls, so you can copy the CA before the timeline
              finishes cooking.
            </p>
            <div>
              <StartTrackingButton>Start tracking</StartTrackingButton>
            </div>
          </div>
          <div className="hero-panel relative">
            <div className="hero-glow" aria-hidden />
            <div className="relative">
              <LiveFeed />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-8">
          <div className="panel reveal grid grid-cols-2 divide-y divide-white/8 overflow-hidden rounded-2xl md:grid-cols-4 md:divide-x md:divide-y-0">
          {(
            [
              { value: <CountUp to={9.4} decimals={1} suffix="M+" />, label: 'CA posts scanned daily' },
              { value: <CountUp to={62} suffix="k" />, label: 'tickers watched' },
              { value: <CountUp to={1.4} decimals={1} suffix="s" />, label: 'median CA alert' },
              { value: <CountUp to={24} next={7} />, label: 'Solana + ETH stream' },
            ] as const
          ).map((stat) => (
            <div key={stat.label} className="p-5">
              <p className="text-3xl font-semibold tracking-tight text-blurple">{stat.value}</p>
              <p className="mt-2 text-sm text-neutral-500">{stat.label}</p>
            </div>
          ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
            <p className="reveal text-sm font-medium text-blurple">Features</p>
            <h2 className="reveal mt-3 max-w-xl text-3xl font-semibold tracking-tight">
              Everything you need to hunt memecoins on X without living in CT.
            </h2>
            <div className="reveal-stagger mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  {
                    Icon: ClipboardDocumentIcon,
                    title: 'CA detection',
                    body: 'Pull Solana and ETH contract addresses out of tweets, replies, and images. One tap to copy.',
                  },
                  {
                    Icon: UserGroupIcon,
                    title: 'KOL tracking',
                    body: 'Follow the wallets-with-followings. See who called the ticker and when the quote-tweets started.',
                  },
                  {
                    Icon: HashtagIcon,
                    title: 'Ticker streams',
                    body: 'Watch $TICKER, cashtags, and misspellings as a coin starts to run.',
                  },
                  {
                    Icon: BellAlertIcon,
                    title: 'Launch alerts',
                    body: 'Get pinged when a new CA hits a threshold of mentions or a bonding curve opens.',
                  },
                  {
                    Icon: BoltIcon,
                    title: 'Mention spikes',
                    body: 'Catch sudden volume on a ticker before it hits trending or the next bundle.',
                  },
                  {
                    Icon: ChartBarIcon,
                    title: 'Rug filters',
                    body: 'Hide suspected rugs, low-liq deploys, and recycled CAs from the live feed.',
                  },
                ] satisfies { Icon: Icon; title: string; body: string }[]
              ).map(({ Icon, title, body }) => (
                <article key={title} className="panel reveal-item rounded-2xl p-5">
                  <span className="icon-tile">
                    <LiveIcon icon={Icon} size={20} />
                  </span>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    {body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
            <p className="reveal text-sm font-medium text-blurple">How it works</p>
            <h2 className="reveal mt-3 max-w-xl text-3xl font-semibold tracking-tight">
              Three steps from CT noise to a CA you can ape.
            </h2>
            <HowTimeline />
          </div>
        </section>

        <section id="use-cases" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
            <p className="reveal text-sm font-medium text-blurple">Use cases</p>
            <h2 className="reveal mt-3 max-w-xl text-3xl font-semibold tracking-tight">
              Built for snipers, KOLs, and degens.
            </h2>
            <div className="reveal-stagger mt-12 grid gap-4 md:grid-cols-3">
              {(
                [
                  {
                    Icon: BoltIcon,
                    title: 'Snipers',
                    body: 'See the CA the second CT starts pasting it. Copy and route to your terminal.',
                  },
                  {
                    Icon: UserGroupIcon,
                    title: 'KOL desks',
                    body: 'Track who called what, how fast the quote-tweets stacked, and which wallets followed.',
                  },
                  {
                    Icon: ChartBarIcon,
                    title: 'Degen research',
                    body: 'Compare ticker spikes vs. CA posts so you can tell a real run from a recycled contract.',
                  },
                ] satisfies { Icon: Icon; title: string; body: string }[]
              ).map(({ Icon, title, body }) => (
                <article key={title} className="panel reveal-item rounded-2xl p-5">
                  <span className="icon-tile">
                    <LiveIcon icon={Icon} size={20} />
                  </span>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    {body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24">
          <div className="mx-auto max-w-3xl px-6 py-20 md:py-24">
            <p className="reveal text-sm font-medium text-blurple">FAQ</p>
            <h2 className="reveal mt-3 text-3xl font-semibold tracking-tight">
              Questions, answered.
            </h2>
            <div className="panel reveal mt-12 flex flex-col divide-y divide-white/8 overflow-hidden rounded-2xl">
              {[
                [
                  'Does this work with X / Twitter?',
                  'Yes. Trackr reads public posts, replies, and quote-tweets on X for tickers and CAs.',
                ],
                [
                  'Which chains do you parse?',
                  'Solana and ETH to start. Pump.fun-style addresses and 0x contracts both copy in one tap.',
                ],
                [
                  'Can I hide rugs and low-liq deploys?',
                  'Yes. Feed settings let you filter by chain, min mentions, KOL-only, and suspected rugs.',
                ],
                [
                  'How fast is a CA alert?',
                  'Most contract alerts land in under two seconds after the tweet is public.',
                ],
                [
                  'What does free include?',
                  'Three tickers and one KOL stream. Upgrade when you want more desks or chains.',
                ],
                [
                  'Do you store my X login?',
                  'No. Trackr reads public posts. Sign-in is for your workspace, not your X account.',
                ],
              ].map(([q, a]) => (
                <FaqItem key={q} question={q} answer={a} />
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-6 pb-20 md:pb-24">
            <div className="panel reveal flex flex-col items-start gap-6 rounded-2xl px-6 py-10 md:items-center md:px-12 md:py-16 md:text-center">
              <h2 className="max-w-xl text-3xl font-semibold tracking-tight">
                Start tracking the coins CT is about to run.
              </h2>
              <p className="max-w-lg text-neutral-400">
                Catch the ticker, the CA, and the KOL call before the timeline
                finishes cooking.
              </p>
              <StartTrackingButton>Start tracking</StartTrackingButton>
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  )
}

type FeedItem = (typeof liveFeed)[number] | import('./useTrackerFeed').TrackerFeedItem

function shortAddress(address: string) {
  if (address.length < 12) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function chainTag(chain: string) {
  return chain === 'ETH' ? 'ETH' : 'SOL'
}

function tweetUrl(handle: string) {
  return `https://x.com/${handle.replace('@', '')}`
}

function sourceTweetUrl(item: { handle: string; tweetLink?: string }) {
  return item.tweetLink || tweetUrl(item.handle)
}

function tokenUrl(chain: string, contract: string) {
  if (!contract) return '#'
  return chain === 'ETH'
    ? `https://dexscreener.com/ethereum/${contract}`
    : `https://dexscreener.com/solana/${contract}`
}

function DeskLink({
  href,
  children,
  tone = 'ghost',
}: {
  href: string
  children: ReactNode
  tone?: 'ghost' | 'fill'
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={
        tone === 'fill'
          ? 'inline-flex items-center justify-center gap-1.5 rounded-md bg-blurple px-3 py-2 text-sm font-medium text-white'
          : 'inline-flex items-center justify-center gap-1.5 rounded-md border border-white/12 px-3 py-2 text-sm text-neutral-200 hover:bg-white/[0.04]'
      }
    >
      {children}
    </a>
  )
}

function TokenPageLink({ chain, contract }: { chain: string; contract: string }) {
  return (
    <DeskLink href={tokenUrl(chain, contract)} tone="fill">
      <ChartBarSmallIcon className="size-4" />
      Open token page
    </DeskLink>
  )
}

function SourceTweetLink({
  item,
}: {
  item: { handle: string; tweetLink?: string }
}) {
  return (
    <DeskLink href={sourceTweetUrl(item)}>
      <ChatBubbleSmallIcon className="size-4" />
      Open source tweet
    </DeskLink>
  )
}

function CaBox({
  address,
  ticker,
  chain,
}: {
  address: string
  ticker: string
  chain: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md bg-page px-2.5 py-2">
      <span className="size-1.5 shrink-0 rounded-full bg-blurple" />
      <ContractCopy address={address} />
      <span className="min-w-0 truncate text-sm font-medium text-[#4ade80]">
        {displayTicker(ticker)}
      </span>
      <span className="shrink-0 text-xs text-neutral-500">{chainTag(chain)}</span>
    </div>
  )
}

function TrackerPanel() {
  const feedRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const pillFastRef = useRef<HTMLSpanElement>(null)
  const pillSlowRef = useRef<HTMLSpanElement>(null)
  const tweetsTabRef = useRef<HTMLButtonElement>(null)
  const watchTabRef = useRef<HTMLButtonElement>(null)
  const pillReady = useRef(false)
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const settingsFold = useRef<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { items: liveItems, status, live, socketConnected } = useTrackerFeed()
  const [tab, setTab] = useState<'tweets' | 'watchlist'>('tweets')
  const [picked, setPicked] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState({
    chain: 'All',
    minMentions: '0',
    showCa: true,
    hideRugs: true,
    kolOnly: false,
  })
  const [importDraft, setImportDraft] = useState('')
  const [importNote, setImportNote] = useState('')
  const feedSource = liveItems.length > 0 ? liveItems : live ? liveItems : liveFeed
  const { watchlist, addFromText, remove, toggle, isWatched, matchesAny } =
    useWatchlist(feedSource)

  const visibleFeed = useMemo(() => {
    return feedSource.filter((item) => {
      if (item.ticker.length > 16 || item.name.length > 48) return false
      if (settings.chain !== 'All' && item.chain !== settings.chain) return false
      if (settings.kolOnly && item.tag !== 'KOL') return false
      if (item.mentions < Number(settings.minMentions || 0)) return false
      return true
    })
  }, [feedSource, settings])

  const watchedFeed = useMemo(
    () => visibleFeed.filter((item) => matchesAny(item)),
    [visibleFeed, matchesAny, watchlist],
  )

  const tabFeed = tab === 'watchlist' ? watchedFeed : visibleFeed

  const selected =
    tabFeed.find((item) => `${item.handle}:${item.contract}` === picked) ??
    tabFeed[0]

  function pick(item: FeedItem) {
    setPicked(`${item.handle}:${item.contract}`)
  }

  function applyImport(text: string) {
    const result = addFromText(text)
    setImportNote(result.note)
  }

  function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void file.text().then(applyImport)
  }

  useGSAP(
    () => {
      gsap.to('.desk-pulse', {
        opacity: 0.25,
        duration: 0.9,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      })
    },
    { scope: feedRef },
  )

  useGSAP(
    () => {
      const container = tabsRef.current
      const fast = pillFastRef.current
      const slow = pillSlowRef.current
      const active = tab === 'tweets' ? tweetsTabRef.current : watchTabRef.current
      if (!container || !fast || !slow || !active) return

      const box = container.getBoundingClientRect()
      const target = active.getBoundingClientRect()
      const next = {
        x: target.left - box.left,
        y: target.top - box.top,
        width: target.width,
        height: target.height,
      }

      if (!pillReady.current) {
        gsap.set([fast, slow], next)
        pillReady.current = true
        return
      }

      gsap.killTweensOf([fast, slow])
      gsap.to(fast, {
        ...next,
        duration: 0.38,
        ease: 'expo.out',
      })
      gsap.to(slow, {
        ...next,
        duration: 0.68,
        ease: 'power3.out',
      })
    },
    { scope: feedRef, dependencies: [tab] },
  )

  useGSAP(
    () => {
      const wrap = settingsWrapRef.current
      if (!wrap) return
      if (settingsFold.current === null) {
        settingsFold.current = settingsOpen
        gsap.set(wrap, { height: 0, autoAlpha: 0 })
        return
      }
      if (settingsFold.current === settingsOpen) return
      settingsFold.current = settingsOpen
      foldPanel(wrap, settingsOpen, { ease: 'power3.out', duration: 0.35 })
    },
    { scope: feedRef, dependencies: [settingsOpen] },
  )

  return (
    <div ref={feedRef} className="flex h-svh flex-col bg-page font-sans text-neutral-100">
      <header className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <LiveIcon icon={SignalIcon} size={16} loop />
            Trackr
          </p>
          <span className="rounded-md bg-blurple/20 px-1.5 py-0.5 text-[11px] font-medium text-blurple">
            FOMO
          </span>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div
          ref={tabsRef}
          className="relative flex items-center rounded-full border border-white/8 bg-raised p-1.5 text-xs"
        >
          <svg width="0" height="0" className="absolute" aria-hidden="true">
            <defs>
              <filter id="desk-tab-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feColorMatrix
                  in="blur"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                />
              </filter>
            </defs>
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ filter: 'url(#desk-tab-goo)' }}
          >
            <span
              ref={pillSlowRef}
              className="absolute top-0 left-0 rounded-full bg-neutral-100"
            />
            <span
              ref={pillFastRef}
              className="absolute top-0 left-0 rounded-full bg-neutral-100"
            />
          </div>
          <button
            ref={tweetsTabRef}
            type="button"
            onClick={() => setTab('tweets')}
            className={`relative z-10 inline-flex h-8 w-[8.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 transition-colors duration-200 ${
              tab === 'tweets' ? 'text-neutral-950' : 'text-neutral-400'
            }`}
          >
            <BoltSmallIcon className="size-4" />
            CA Tweets
          </button>
          <button
            ref={watchTabRef}
            type="button"
            onClick={() => setTab('watchlist')}
            className={`relative z-10 inline-flex h-8 w-[8.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 transition-colors duration-200 ${
              tab === 'watchlist' ? 'text-neutral-950' : 'text-neutral-400'
            }`}
          >
            <EyeSmallIcon className="size-4" />
            Watchlist
          </button>
        </div>
        <div className="flex items-center gap-2">
          <p className="inline-flex items-center gap-2 text-xs text-neutral-500">
            <span
              className={`desk-pulse size-1.5 rounded-full ${
                socketConnected && status.connected ? 'bg-blurple' : 'bg-amber-400'
              }`}
            />
            {socketConnected && status.connected
              ? liveItems.length > 0
                ? 'Live feed'
                : 'Waiting for CAs'
              : socketConnected
                ? 'Upstream reconnecting'
                : 'Reconnecting'}
          </p>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs ${
              settingsOpen
                ? 'border-neutral-100 bg-neutral-100 text-neutral-950'
                : 'border-white/8 bg-raised text-neutral-400'
            }`}
            aria-expanded={settingsOpen}
          >
            <LiveIcon icon={Cog6ToothIcon} size={16} />
            Settings
          </button>
        </div>
      </div>

      <div ref={settingsWrapRef} className="h-0 overflow-hidden opacity-0">
        <div className="grid gap-3 border-b border-white/8 px-4 py-3 text-sm sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-500">Chain</span>
            <select
              value={settings.chain}
              onChange={(event) =>
                setSettings((current) => ({ ...current, chain: event.target.value }))
              }
              className="rounded-md border border-white/8 bg-raised px-3 py-1.5 outline-none focus:border-blurple"
            >
              <option>All</option>
              <option>Solana</option>
              <option>ETH</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-500">Min mentions / hour</span>
            <input
              type="number"
              min="0"
              value={settings.minMentions}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  minMentions: event.target.value,
                }))
              }
              className="rounded-md border border-white/8 bg-raised px-3 py-1.5 outline-none focus:border-blurple"
            />
          </label>
          <AnimatedCheck
            checked={settings.showCa}
            onChange={(showCa) => setSettings((current) => ({ ...current, showCa }))}
          >
            Show contract addresses
          </AnimatedCheck>
          <AnimatedCheck
            checked={settings.hideRugs}
            onChange={(hideRugs) => setSettings((current) => ({ ...current, hideRugs }))}
          >
            Hide suspected rugs
          </AnimatedCheck>
          <AnimatedCheck
            checked={settings.kolOnly}
            onChange={(kolOnly) => setSettings((current) => ({ ...current, kolOnly }))}
            className="sm:col-span-2"
          >
            KOL calls only
          </AnimatedCheck>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_18.5rem]">
        <section className="flex min-h-0 flex-col border-white/8 lg:border-r">
          {selected ? (
            <div className="shrink-0 border-b border-white/8 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                    <span className="size-1.5 shrink-0 rounded-full bg-blurple" />
                    <span className="truncate">{displayTicker(selected.ticker)}</span>
                  </span>
                  <span className="min-w-0 truncate text-neutral-500">
                    detected in {selected.handle}
                  </span>
                  <span className="font-mono text-xs text-neutral-400">
                    {shortAddress(selected.contract)}
                  </span>
                  <span className="text-xs text-neutral-500">{chainTag(selected.chain)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(selected)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
                    isWatched(selected)
                      ? 'border-blurple/40 bg-blurple/10 text-blurple'
                      : 'border-white/12 text-neutral-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <BookmarkSmallIcon className="size-4" />
                  {isWatched(selected) ? 'Watching' : 'Add to watchlist'}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] tracking-wide text-neutral-500">
                <p>
                  CONTRACT TWEETS{' '}
                  <span className="text-neutral-200">{tabFeed.length}</span>
                </p>
                <p className="inline-flex items-center gap-1.5 text-neutral-300">
                  <span className="desk-pulse size-1.5 rounded-full bg-blurple" />
                  LIVE
                </p>
              </div>
            </div>
          ) : null}

          {tab === 'watchlist' && (
            <div className="shrink-0 border-b border-white/8 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={importDraft}
                  onChange={(event) => setImportDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    if (!importDraft.trim()) return
                    applyImport(importDraft)
                    setImportDraft('')
                  }}
                  placeholder="$WIF, @handle, or CA"
                  className="min-w-0 flex-1 rounded-md border border-white/8 bg-raised px-3 py-1.5 text-sm outline-none focus:border-blurple"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!importDraft.trim()) return
                    applyImport(importDraft)
                    setImportDraft('')
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/8 px-2.5 py-1.5 text-xs text-neutral-300"
                >
                  <LiveIcon icon={PlusIcon} size={14} />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/8 px-2.5 py-1.5 text-xs text-neutral-300"
                >
                  <LiveIcon icon={ArrowUpTrayIcon} size={14} />
                  {importNote || 'Import'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,.tsv,text/plain,text/csv"
                  className="sr-only"
                  onChange={onImportFile}
                />
              </div>
              {watchlist.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {watchlist.map((item) => (
                    <button
                      key={watchKey(item)}
                      type="button"
                      onClick={() => remove(item)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/8 bg-raised px-2 py-1 text-[11px] text-neutral-300"
                    >
                      {displayTicker(item.ticker)}
                      <LiveIcon icon={XMarkIcon} size={12} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'watchlist' && watchlist.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500">
                Nothing on the list. Add a ticker, handle, or CA, or bookmark a tweet.
              </p>
            ) : tabFeed.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500">
                {tab === 'watchlist'
                  ? 'Watching. Waiting for matching CA tweets...'
                  : status.connected
                    ? 'Waiting for contract tweets...'
                    : 'Connecting to feed...'}
              </p>
            ) : (
              tabFeed.map((item, index) => {
                const active = selected
                  ? `${item.handle}:${item.contract}` ===
                    `${selected.handle}:${selected.contract}`
                  : index === 0
                const itemKey =
                  'id' in item && typeof item.id === 'string'
                    ? item.id
                    : `${item.handle}-${item.contract}`
                const watched = isWatched(item)
                return (
                  <article
                    key={itemKey}
                    className={`border-b border-white/8 px-4 py-3 ${
                      active ? 'bg-white/[0.03]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => pick(item)}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                      >
                        <TweetAvatar
                          src={item.avatar}
                          name={item.name}
                          handle={item.handle}
                          badge={'badge' in item ? item.badge : null}
                        />
                        <p className="flex min-w-0 items-center gap-1 truncate text-[13px]">
                          <span className="truncate font-semibold">{item.name}</span>
                          <VerifiedBadge badge={'badge' in item ? item.badge : null} />
                          <span className="truncate text-neutral-500">{item.handle}</span>
                          <span className="shrink-0 text-neutral-600">·</span>
                          <TimeAgo
                            createdAt={'createdAt' in item ? item.createdAt : undefined}
                            fallback={item.time}
                            live={index === 0}
                          />
                        </p>
                      </button>
                      <button
                        type="button"
                        aria-label={watched ? `Unwatch ${item.ticker}` : `Watch ${item.ticker}`}
                        onClick={() => toggle(item)}
                        className={`inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md ${
                          watched
                            ? 'text-blurple hover:bg-white/8'
                            : 'text-neutral-500 hover:bg-white/8 hover:text-neutral-100'
                        }`}
                      >
                        <BookmarkSmallIcon className="size-4" />
                      </button>
                    </div>
                    {settings.showCa ? (
                      <div className="mt-2.5">
                        <CaBox
                          address={item.contract}
                          ticker={item.ticker}
                          chain={item.chain}
                        />
                      </div>
                    ) : null}
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <TokenPageLink chain={item.chain} contract={item.contract} />
                      <SourceTweetLink item={item} />
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4 lg:flex">
          {selected ? (
            <>
              <div>
                <p className="text-[11px] tracking-wide text-neutral-500">OPEN SELECTED</p>
                <div className="mt-2 flex flex-col gap-2">
                  <SourceTweetLink item={selected} />
                  <TokenPageLink chain={selected.chain} contract={selected.contract} />
                  <button
                    type="button"
                    onClick={() => toggle(selected)}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm ${
                      isWatched(selected)
                        ? 'border-blurple/40 bg-blurple/10 text-blurple'
                        : 'border-white/12 text-neutral-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <BookmarkSmallIcon className="size-4" />
                    {isWatched(selected) ? 'Watching' : 'Add to watchlist'}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] tracking-wide text-neutral-500">CONTRACT</p>
                <dl className="mt-2 divide-y divide-white/8 rounded-md border border-white/8 text-sm">
                  {[
                    ['Network', chainTag(selected.chain)],
                    ['Address', shortAddress(selected.contract)],
                    ['Ticker', displayTicker(selected.ticker)],
                    ['Handle', selected.handle],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-neutral-500">{label}</dt>
                      <dd className={label === 'Ticker' ? 'text-[#4ade80]' : 'text-neutral-100'}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">No CA selected.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function PanelPage() {
  useEffect(() => {
    document.title = 'Trackr — Panel'
    return () => {
      document.title = 'Trackr — Memecoin X tracker'
    }
  }, [])

  return <TrackerPanel />
}

function App() {
  const path = usePath()
  if (path === '/use') return <UsePage />
  if (path === '/panel') return <PanelPage />
  return <Landing />
}

export default App
