import Link from "next/link";

export default function HomePage() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[2rem] bg-white p-8 shadow-soft sm:p-12">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-calm">AI life agent</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
          Tell me what you need.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-gray-600">
          I will help turn it into something you can actually get done. NOVA understands, asks only what is missing, prepares a task, and shows exactly what happened.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/chat" className="rounded-full bg-ink px-6 py-4 text-center font-medium text-white">
            Get started
          </Link>
          <Link href="/discover" className="rounded-full border border-gray-200 px-6 py-4 text-center font-medium">
            Explore services
          </Link>
        </div>
      </div>
      <div className="rounded-[2rem] bg-[#e9dfd0] p-8 shadow-soft">
        <h2 className="text-2xl font-semibold">Try saying</h2>
        <div className="mt-6 grid gap-3 text-gray-700">
          {[
            "N7eb plombier fi Ariana.",
            "Help me organize my week.",
            "Need someone to fix my AC tomorrow",
            "Set a reminder for tomorrow.",
          ].map((text) => (
            <div key={text} className="rounded-2xl bg-white/70 p-4">{text}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
