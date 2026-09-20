"use client";

//non exports
import TemporalButton from "@/components/ui/TemporalButton";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-linear-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Get started by editing&nbsp;
          <code className="font-mono font-bold">app/page.tsx</code>
        </p>
      </div>
      <div className="relative flex place-items-center before:absolute before:h-75 before:w-120 before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-45 after:w-60 after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:to-transparent after:blur-2xl after:content-[''] min-h-screen flex-col items-center justify-between p-24">
        <h1 className="text-4xl font-bold mb-4">Vía Atlixco</h1>
        <TemporalButton onClick={() => router.push("/profile")} />
        <p className="text-lg text-gray-600 dark:text-gray-400">
          En desarrollo
        </p>
      </div>
    </main>
  );
}
