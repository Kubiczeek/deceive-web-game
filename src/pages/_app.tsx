import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'

function detectTheme() {
  if (typeof window === 'undefined') return
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', isDark)
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    detectTheme()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', detectTheme)
    return () => mq.removeEventListener('change', detectTheme)
  }, [])

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#00d4ff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <title>Deceive</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}
