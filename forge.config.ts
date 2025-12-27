import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'AI Dev Browser',
    executableName: 'ai-dev-browser',
    asar: true,
    icon: './assets/icons/icon',
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
    // Windows
    new MakerSquirrel({
      name: 'AIDevBrowser',
      authors: 'FlashAppAI Team',
      description: 'AI-powered browser for developers',
      iconUrl: 'https://raw.githubusercontent.com/flashappai/ai-dev-browser/main/assets/icons/icon.ico',
      setupIcon: './assets/icons/icon.ico',
      certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
      certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
    }),
    // macOS ZIP
    new MakerZIP({}, ['darwin']),
    // macOS DMG
    new MakerDMG({
      name: 'AI-Dev-Browser',
      icon: './assets/icons/icon.icns',
      background: './assets/dmg-background.png',
      format: 'ULFO',
    }, ['darwin']),
    // Linux DEB
    new MakerDeb({
      options: {
        name: 'ai-dev-browser',
        productName: 'AI Dev Browser',
        genericName: 'Web Browser',
        description: 'AI-powered browser for developers',
        categories: ['Development', 'Network', 'WebBrowser'],
        icon: './assets/icons/icon.png',
        maintainer: 'FlashAppAI Team',
        homepage: 'https://flashappai.org',
      },
    }),
    // Linux RPM
    new MakerRpm({
      options: {
        name: 'ai-dev-browser',
        productName: 'AI Dev Browser',
        description: 'AI-powered browser for developers',
        categories: ['Development', 'Network', 'WebBrowser'],
        icon: './assets/icons/icon.png',
        homepage: 'https://flashappai.org',
      },
    }),
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
          owner: 'flashappai',
          name: 'ai-dev-browser',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

export default config;

