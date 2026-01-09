import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDeb } from '@electron-forge/maker-deb';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'FlashAppAI Browser',
    executableName: 'FlashAppAI-Browser',
    asar: {
      unpack: '**/{*.node,node_modules/electron-store/**/*,node_modules/conf/**/*,node_modules/atomically/**/*}'
    },
    icon: './assets/icons/icon',
    extraResource: [
      './src/renderer/browser-ui.html',
      './src/renderer/phantom-mode.html',
    ],
    appBundleId: 'com.flashappai.browser',
    appCategoryType: 'public.app-category.developer-tools',
    osxSign: {
      identity: process.env.APPLE_IDENTITY || undefined,
      optionsForFile: () => ({
        entitlements: './entitlements.plist',
      }),
    },
    osxNotarize: process.env.APPLE_ID ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    } : undefined,
    win32metadata: {
      CompanyName: 'FlashAppAI',
      ProductName: 'AI Dev Browser',
      FileDescription: 'AI-powered browser for developers',
    },
  },
  rebuildConfig: {},
  makers: [
    // Windows Squirrel installer (.exe setup) - only on Windows
    new MakerSquirrel({
      name: 'FlashAppAIBrowser',
      setupExe: 'FlashAppAI-Browser-Setup.exe',
      setupIcon: './assets/icons/icon.ico',
      // Don't use iconUrl - it can cause issues
      noMsi: true,
    }, ['win32']),
    // Linux Debian package (.deb) - only on Linux
    new MakerDeb({
      options: {
        name: 'flashappai-browser',
        productName: 'FlashAppAI Browser',
        genericName: 'Web Browser',
        description: 'AI-powered browser for developers with built-in privacy features',
        categories: ['Network', 'WebBrowser', 'Development'],
        icon: './assets/icons/icon_256x256.png',
        maintainer: 'FlashAppAI <support@flashappai.org>',
        homepage: 'https://flashappai.org',
      },
    }, ['linux']),
    // ZIP for all platforms (simple, always works)
    new MakerZIP({}),
    // macOS DMG
    new MakerDMG({
      name: 'FlashAppAI-Browser',
      format: 'ULFO',
    }, ['darwin']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'ashuxen',
          name: 'ai-dev-browser',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

export default config;


