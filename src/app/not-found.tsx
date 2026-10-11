import Link from "next/link";
export default function NotFound() {
    return (<main className="grid min-h-dvh place-items-center bg-page p-8 text-fg">
      <div className="flex max-w-md flex-col gap-4 text-center">
        <span className="eyebrow">404</span>
        <h1 className="h1-display m-0">
          Nothing <em className="font-serif font-normal text-accent">here</em>
        </h1>
        <Link href="/overview">Back to the dashboard →</Link>
      </div>
    </main>);
}
