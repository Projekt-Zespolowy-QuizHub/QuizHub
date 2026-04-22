import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-violet-500 mb-2">404</p>
        <h1 className="text-2xl font-bold mb-2">Strona nie istnieje</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Nie znaleziono strony, której szukasz.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition-colors"
        >
          Wróć do strony głównej
        </Link>
      </div>
    </div>
  );
}
