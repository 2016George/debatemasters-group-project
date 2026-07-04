import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden bg-stone-950 font-headline-pixel text-surface-container-lowest antialiased">
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-stone-950 via-stone-900/60 to-orange-950/40" />
          <img
            alt=""
            className="h-full w-full object-cover opacity-60"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYLpXC8_jPVxaKGxcCSd6eRWWZqRwCh0sNFta2wEbgXHQ9XiKcYbIA_XeQQlpzTYshjjF9v4Uip7_KXAww79lu2eDUSw9J1c1fKg4mqbYizC3Y8yG645t3yMIEo1NsEy07I9mNMqD2ehsKvnUVMpb9orVS3NzaSkZ-wi9WhYrauPr3YM_WxQDd7vwG_AmM5DFKCz2vfs_DZ8D3XrI2Em_vSTIU92D1UTf8PLPbZjkWo-ET_z72Qm4YEtDSXbRiT00GSFA_RGtmOxOa"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.1)_0%,transparent_50%)]" />
        <div className="relative z-30 flex w-full max-w-[100rem] flex-col items-center px-4 py-12 text-center sm:px-6">
          <div className="mb-16 w-full md:mb-24">
            <h1 className="hero-title-master flex flex-col items-center gap-3 font-black uppercase text-orange-500 sm:gap-4 md:gap-5">
              <span className="block leading-none">DEBATE</span>
              <span className="block leading-none">MASTER</span>
            </h1>
            <p className="mx-auto mt-8 max-w-4xl border-2 border-orange-900/60 bg-stone-900/85 px-6 py-3 font-headline-pixel text-sm uppercase tracking-widest text-stone-300 backdrop-blur-md sm:mt-10 sm:px-10 sm:py-4 sm:text-lg md:mt-12 md:text-2xl">
              Built with Bricks. Won with Words.
            </p>
          </div>
          <div className="mt-8 grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            <div className="group flex flex-col items-center border-b-8 border-r-8 border-stone-800 bg-stone-900 p-8 transition-transform hover:-translate-y-2">
              <div className="inner-carve mb-6 flex h-20 w-20 items-center justify-center border-4 border-stone-700 bg-stone-800">
                <MaterialIcon
                  name="auto_stories"
                  className="text-5xl text-primary-fixed"
                  filled
                />
              </div>
              <h3 className="pixel-text-base mb-3 text-2xl font-bold uppercase text-primary-fixed font-headline-pixel">
                Level Up Your Skills
              </h3>
              <p className="pixel-text-xs text-sm font-medium leading-relaxed text-stone-400">
                Master the enchanted scrolls of rhetoric and unlock elite XP
                orbs for every logical strike.
              </p>
              <div className="inner-carve mt-6 h-2 w-full overflow-hidden bg-stone-950">
                <div className="h-full w-2/3 bg-primary-container shadow-[0_0_10px_#4da63a]" />
              </div>
            </div>
            <div className="group flex flex-col items-center border-b-8 border-r-8 border-stone-800 bg-stone-900 p-8 transition-transform hover:-translate-y-2">
              <div className="inner-carve mb-6 flex h-20 w-20 items-center justify-center border-4 border-stone-700 bg-stone-800">
                <MaterialIcon
                  name="diversity_3"
                  className="text-5xl text-tertiary-fixed"
                  filled
                />
              </div>
              <h3 className="pixel-text-base mb-3 text-2xl font-bold uppercase text-tertiary-fixed font-headline-pixel">
                Epic Friends
              </h3>
              <p className="pixel-text-xs text-sm font-medium leading-relaxed text-stone-400">
                Form blocky alliances in the lobby. Debate, high-five, and build
                your reputation together.
              </p>
              <div className="mt-6 flex -space-x-4">
                <div className="h-10 w-10 border-2 border-stone-900 bg-stone-700" />
                <div className="h-10 w-10 border-2 border-stone-900 bg-stone-600" />
                <div className="h-10 w-10 border-2 border-stone-900 bg-stone-500" />
                <div className="flex h-10 w-10 items-center justify-center border-2 border-stone-900 bg-primary-container pixel-text-sm font-bold">
                  +99
                </div>
              </div>
            </div>
            <div className="group flex flex-col items-center border-b-8 border-r-8 border-stone-800 bg-stone-900 p-8 transition-transform hover:-translate-y-2">
              <div className="inner-carve mb-6 flex h-20 w-20 items-center justify-center border-4 border-stone-700 bg-stone-800">
                <MaterialIcon
                  name="shield"
                  className="text-5xl text-orange-400"
                  filled
                />
              </div>
              <h3 className="pixel-text-base mb-3 text-2xl font-bold uppercase text-orange-400 font-headline-pixel">
                Safe and Fun
              </h3>
              <p className="pixel-text-xs text-sm font-medium leading-relaxed text-stone-400">
                Our golden shield protection ensures every argument is
                constructive and every debate stays fun.
              </p>
              <div className="mt-6 flex items-center gap-2">
                <MaterialIcon
                  name="verified"
                  className="text-sm text-orange-600"
                  filled
                />
                <span className="pixel-text-xs font-bold uppercase tracking-widest text-stone-500">
                  Griefer-Free Zone
                </span>
              </div>
            </div>
          </div>
          <div className="mt-16 flex flex-col items-center space-y-6">
            <div className="mt-4 flex flex-wrap justify-center gap-6">
              <Link
                href="/login"
                className="hard-shadow-stone pixel-text-sm bg-stone-700 px-8 py-3 font-headline-pixel text-lg font-bold uppercase tracking-widest text-stone-100 transition-all hover:bg-stone-600 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="hard-shadow-stone pixel-text-sm bg-stone-700 px-8 py-3 font-headline-pixel text-lg font-bold uppercase tracking-widest text-stone-100 transition-all hover:bg-stone-600 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                Register
              </Link>
            </div>
            <div className="pixel-text-xs flex items-center gap-4 text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
              <span>ENTER THE ARENA</span>
              <span className="h-2 w-2 bg-orange-600" />
              <span>12,403 BUILDERS ONLINE</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-10 -left-10 z-10 hidden h-32 w-64 -rotate-3 transform border-r-8 border-t-8 border-stone-800 bg-stone-900 opacity-50 lg:block" />
        <div className="absolute top-40 -right-20 z-10 hidden h-40 w-80 rotate-12 transform border-b-8 border-l-8 border-stone-900 bg-stone-950 opacity-40 lg:block" />
      </main>
      <footer className="relative z-40 flex w-full flex-col items-center border-t-8 border-orange-950 bg-stone-950 px-12 py-12">
        <div className="mb-8 md:mb-0">
          <span className="pixel-text-base font-headline-pixel text-xl font-black text-stone-600">
            DEBATE MASTER
          </span>
          <p className="pixel-text-xs mt-2 uppercase tracking-[0.3em] text-stone-700 font-headline-pixel">
            © 2024 DEBATE MASTER - BUILT WITH BRICKS
          </p>
        </div>
      </footer>
      <div className="fixed bottom-0 left-0 z-50 h-1 w-full bg-gradient-to-r from-transparent via-orange-600 to-transparent blur-sm" />
    </div>
  );
}
