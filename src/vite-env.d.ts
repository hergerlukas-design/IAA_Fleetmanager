/// <reference types="vite/client" />

declare module '../../package.json' {
  const value: { version: string; [key: string]: unknown }
  export default value
}
