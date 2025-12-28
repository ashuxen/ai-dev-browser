import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'AI Dev Browser',
    executableName: 'ai-dev-browser',
    asar: {
      unpack: '**/{*.node,node_modules/electron-store/**/*,node_modules/conf/**/*,node_modules/atomically/**/*}'
    },
    icon: './assets/icons/icon',
    extraResource: [
      './src/renderer/browser-ui.html',
      './src/renderer/phantom-mode.html',
    ],
    appBundleId: 'com.flashappai.aidevbrowser',
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


