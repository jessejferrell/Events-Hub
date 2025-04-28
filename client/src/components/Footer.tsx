import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="mt-auto py-4 border-t border-neutral-200 text-sm text-neutral-500">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
        <div>&copy; {new Date().getFullYear()} City Event Hub. All rights reserved.</div>
        <div className="flex mt-2 md:mt-0 space-x-4">
          <Link href="/help">
            <a className="hover:text-neutral-700">Help</a>
          </Link>
          <Link href="/privacy">
            <a className="hover:text-neutral-700">Privacy</a>
          </Link>
          <Link href="/terms">
            <a className="hover:text-neutral-700">Terms</a>
          </Link>
        </div>
      </div>
    </footer>
  );
}
