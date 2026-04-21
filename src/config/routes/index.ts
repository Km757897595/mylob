import { type LucideIcon } from 'lucide-react';
import {
  BrainCircuit,
  FilePenIcon,
  Image,
  LibraryBigIcon,
  Mic,
  Settings,
  ShapesIcon,
  Video,
  VideoOff,
} from 'lucide-react';

export interface NavigationRoute {
  /** CMDK i18n key in common namespace */
  cmdkKey: string;
  /** Electron i18n key in electron namespace */
  electronKey: string;
  /** Route icon component */
  icon: LucideIcon;
  /** Unique route identifier */
  id: string;
  /** Keywords for CMDK search (fallback) */
  keywords?: string[];
  /** i18n key for CMDK keywords in common namespace */
  keywordsKey?: string;
  /** Route path */
  path: string;
  /** Path prefix for checking current location */
  pathPrefix: string;
  /** Whether route supports dynamic titles (for specific items) */
  useDynamicTitle?: boolean;
}

/**
 * Shared navigation route configuration
 * Used by both Electron navigation and CommandMenu (CMDK)
 */
export const NAVIGATION_ROUTES: NavigationRoute[] = [
  {
    cmdkKey: 'cmdk.community',
    electronKey: 'navigation.discover',
    icon: ShapesIcon,
    id: 'community',
    keywords: ['discover', 'market', 'assistant', 'model', 'provider', 'mcp'],
    keywordsKey: 'cmdk.keywords.community',
    path: '/community',
    pathPrefix: '/community',
  },
  {
    cmdkKey: 'cmdk.video',
    electronKey: 'navigation.video',
    icon: Video,
    id: 'video',
    keywords: ['video', 'generate', 'seedance', 'kling'],
    keywordsKey: 'cmdk.keywords.video',
    path: '/video',
    pathPrefix: '/video',
  },
  {
    cmdkKey: 'cmdk.videoEdit',
    electronKey: 'navigation.videoEdit',
    icon: VideoOff,
    id: 'video-edit',
    keywords: ['video', 'edit', 'wan', 'modify'],
    keywordsKey: 'cmdk.keywords.videoEdit',
    path: '/video-edit',
    pathPrefix: '/video-edit',
  },
  {
    cmdkKey: 'cmdk.speech',
    electronKey: 'navigation.speech',
    icon: Mic,
    id: 'speech',
    keywords: ['speech', 'asr', 'transcription', 'voice'],
    keywordsKey: 'cmdk.keywords.speech',
    path: '/speech',
    pathPrefix: '/speech',
  },
  {
    cmdkKey: 'cmdk.painting',
    electronKey: 'navigation.image',
    icon: Image,
    id: 'image',
    keywords: ['painting', 'art', 'generate', 'draw'],
    keywordsKey: 'cmdk.keywords.painting',
    path: '/image',
    pathPrefix: '/image',
  },
  {
    cmdkKey: 'cmdk.resource',
    electronKey: 'navigation.resources',
    icon: LibraryBigIcon,
    id: 'resource',
    keywords: ['knowledge', 'files', 'library', 'documents'],
    keywordsKey: 'cmdk.keywords.resources',
    path: '/resource',
    pathPrefix: '/resource',
  },
  {
    cmdkKey: 'cmdk.pages',
    electronKey: 'navigation.pages',
    icon: FilePenIcon,
    id: 'page',
    keywords: ['documents', 'write', 'notes'],
    keywordsKey: 'cmdk.keywords.pages',
    path: '/page',
    pathPrefix: '/page',
    useDynamicTitle: true,
  },
  {
    cmdkKey: 'cmdk.memory',
    electronKey: 'navigation.memory',
    icon: BrainCircuit,
    id: 'memory',
    keywords: ['identities', 'contexts', 'preferences', 'experiences'],
    keywordsKey: 'cmdk.keywords.memory',
    path: '/memory',
    pathPrefix: '/memory',
  },
  {
    cmdkKey: 'cmdk.settings',
    electronKey: 'navigation.settings',
    icon: Settings,
    id: 'settings',
    keywords: ['settings', 'preferences', 'configuration', 'options'],
    keywordsKey: 'cmdk.keywords.settings',
    path: '/settings',
    pathPrefix: '/settings',
  },
];

/**
 * Get route configuration by id
 */
export const getRouteById = (id: string): NavigationRoute | undefined =>
  NAVIGATION_ROUTES.find((r) => r.id === id);

/**
 * Get navigable routes for CMDK (excludes settings which has separate handling)
 */
export const getNavigableRoutes = (): NavigationRoute[] =>
  NAVIGATION_ROUTES.filter((r) =>
    ['community', 'video', 'video-edit', 'speech', 'image', 'resource', 'page', 'memory'].includes(
      r.id,
    ),
  );
