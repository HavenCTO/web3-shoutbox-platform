import browserSdkPackage from '@xmtp/browser-sdk/package.json'

/** Resolved at build time from the installed `@xmtp/browser-sdk` package. */
export const XMTP_BROWSER_SDK_VERSION: string = browserSdkPackage.version

/** Issue tracker URL from package metadata (for diagnostic payloads). */
export const XMTP_BROWSER_SDK_ISSUES_URL: string =
  typeof browserSdkPackage.bugs?.url === 'string'
    ? browserSdkPackage.bugs.url
    : 'https://github.com/xmtp/xmtp-js/issues'
