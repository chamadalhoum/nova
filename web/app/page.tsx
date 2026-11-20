import Link from "next/link";
import React from "react";

const features = [
  ["Exprimez votre besoin", "Décrivez simplement ce que vous cherchez, avec vos propres mots."],
  ["Clarifiez en confiance", "NOVA vous aide à préciser les informations nécessaires avant toute action."],
  ["Préparez vos actions", "Examinez les tâches et les demandes proposées avant de les confirmer."],
  ["Gardez le fil", "Retrouvez vos conversations, tâches et demandes dans votre espace personnel."],
];

const steps = [
  ["01", "Vous exprimez votre besoin", "Parlez à NOVA naturellement, comme vous le feriez à une personne."],
  ["02", "NOVA comprend et clarifie", "L’assistant vous pose uniquement les questions utiles pour avancer."],
  ["03", "Vous examinez et confirmez", "Vous restez décisionnaire avant la création d’une tâche ou d’une demande."],
  ["04", "Vous suivez votre avancement", "Votre espace personnel rassemble ce qui nécessite votre attention."],
];

export default function HomePage() {
  return (
    <div className="overflow-hidden bg-[#f7f8f5] text-ink">
      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ink text-base font-semibold text-white shadow-sm">N</span>
          <span className="text-xl font-semibold tracking-tight">NOVA</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex" aria-label="Navigation principale">
          <a href="#fonctionnalites" className="rounded-full px-2 py-1 hover:text-ink">Fonctionnalités</a>
          <a href="#fonctionnement" className="rounded-full px-2 py-1 hover:text-ink">Comment ça marche</a>
        </nav>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href="/login" className="rounded-full px-3 py-2 text-ink transition hover:bg-white sm:px-4">Se connecter</Link>
          <Link href="/register" className="rounded-full bg-ink px-4 py-2.5 text-white shadow-sm transition hover:bg-black">Commencer gratuitement</Link>
        </div>
        <nav className="mt-4 flex w-full gap-2 border-t border-gray-200 pt-4 text-sm font-medium text-gray-600 md:hidden" aria-label="Navigation mobile">
          <a href="#fonctionnalites" className="rounded-full bg-white px-3 py-2 hover:text-ink">Fonctionnalités</a>
          <a href="#fonctionnement" className="rounded-full bg-white px-3 py-2 hover:text-ink">Comment ça marche</a>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[38rem] max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-28 lg:pt-20">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-6 inline-flex rounded-full border border-calm/20 bg-white/80 px-4 py-2 text-sm font-semibold text-calm">Un assistant qui vous aide à passer à l’action</p>
            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Transformez vos besoins en actions concrètes.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-gray-600">NOVA vous accompagne pour comprendre votre demande, préparer les prochaines étapes et garder le suivi de ce qui compte pour vous.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className="rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-ink/15 transition hover:-translate-y-0.5 hover:bg-black">Commencer gratuitement</Link>
              <Link href="/login" className="rounded-full border border-gray-300 bg-white px-6 py-3.5 text-sm font-semibold transition hover:border-calm hover:bg-mist">Se connecter</Link>
            </div>
            <p className="mt-5 text-sm text-gray-500">Déjà membre ? <Link href="/app" className="font-semibold text-calm underline underline-offset-4">Accéder à mon espace</Link></p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-label="Aperçu de l’accompagnement NOVA">
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#d8e5df] blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-[#e9decf] blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/90 bg-white/90 p-5 shadow-[0_24px_70px_rgba(17,24,39,0.13)] backdrop-blur sm:p-7">
              <div className="flex items-center justify-between border-b border-gray-100 pb-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-sm font-semibold text-white">N</span><div><p className="font-semibold">Assistant NOVA</p><p className="text-xs text-calm">En ligne pour vous aider</p></div></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>
              <div className="space-y-4 py-6 text-sm leading-6"><div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-mist px-4 py-3 text-gray-700">Bonjour, comment puis-je vous aider aujourd’hui ?</div><div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-ink px-4 py-3 text-white">Je cherche un professionnel pour une réparation.</div><div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-[#d8e5df] bg-[#f4f8f6] px-4 py-3 text-gray-700">Je peux vous aider à préciser votre besoin et à préparer la suite. Dans quelle ville recherchez-vous ce service ?</div></div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400"><span className="flex-1">Décrivez votre besoin…</span><span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-base text-white">↑</span></div>
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="border-y border-[#dce2dd] bg-[#edf2ee] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="max-w-xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-calm">L’essentiel, au bon moment</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Un parcours clair, sans vous enlever le contrôle.</h2></div><div className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] border border-[#d3ddd6] bg-[#d3ddd6] sm:grid-cols-2"><div className="bg-[#edf2ee] p-7"><p className="text-sm font-semibold text-calm">Disponible aujourd’hui</p><h3 className="mt-3 text-2xl font-semibold">De la demande à la confirmation</h3><p className="mt-3 leading-7 text-gray-600">NOVA comprend vos messages, demande les précisions nécessaires et vous laisse confirmer les actions proposées.</p></div>{features.map(([title, description]) => <article key={title} className="bg-[#f7f8f5] p-7"><span className="text-sm font-semibold text-calm">{title}</span><p className="mt-3 leading-7 text-gray-600">{description}</p></article>)}</div><p className="mt-6 text-sm text-gray-600">La découverte de services adaptés est proposée lorsque votre demande le nécessite. Les actions restent toujours soumises à votre confirmation.</p></div>
        </section>

        <section id="fonctionnement" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-calm">Comment ça marche ?</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Un échange simple. Des suites explicites.</h2><p className="mt-5 max-w-md leading-7 text-gray-600">NOVA n’exécute pas à votre place sans validation : elle organise la demande pour vous aider à avancer sereinement.</p></div><ol className="divide-y divide-gray-200">{steps.map(([number, title, description]) => <li key={number} className="grid gap-4 py-6 sm:grid-cols-[4rem_1fr]"><span className="text-sm font-semibold text-calm">{number}</span><div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-2 leading-7 text-gray-600">{description}</p></div></li>)}</ol></div></section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28 lg:px-10"><div className="rounded-[2rem] bg-ink px-7 py-12 text-white sm:px-12 sm:py-16"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b9d5ca]">Prêt à organiser la suite ?</p><div className="mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end"><h2 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Commencez par une conversation avec NOVA.</h2><Link href="/register" className="shrink-0 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-[#d8e5df]">Créer mon espace</Link></div></div></section>
      </main>

      <footer className="border-t border-gray-200 bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] lg:px-10"><div><p className="font-semibold">NOVA</p><p className="mt-2 max-w-sm text-sm leading-6 text-gray-600">Un assistant pour transformer vos besoins en prochaines étapes claires.</p></div><nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-gray-600" aria-label="Navigation de pied de page"><a href="#fonctionnalites" className="hover:text-ink">Fonctionnalités</a><a href="#fonctionnement" className="hover:text-ink">Comment ça marche</a><Link href="/login" className="hover:text-ink">Se connecter</Link><Link href="/register" className="hover:text-ink">Créer un compte</Link></nav></div></footer>
    </div>
  );
}
