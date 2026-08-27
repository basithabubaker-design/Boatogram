import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";

export async function NavBar() {
  const user = await getCurrentUser();

  const dashboardHref = user?.role === "ADMIN" ? "/admin" : user?.role === "OWNER" ? "/owner" : "/dashboard";

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-teal-700">
          Boatogram
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/search" className="text-zinc-600 hover:text-zinc-900">
            Browse boats
          </Link>
          {user ? (
            <>
              <Link href={dashboardHref} className="text-zinc-600 hover:text-zinc-900">
                {user.role === "ADMIN" ? "Admin panel" : user.role === "OWNER" ? "Owner dashboard" : "My bookings"}
              </Link>
              <Link href="/notifications" className="text-zinc-600 hover:text-zinc-900">
                Notifications
              </Link>
              <span className="hidden text-zinc-400 sm:inline">{user.name}</span>
              <form action={logoutAction}>
                <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-teal-600 px-3 py-1.5 text-white hover:bg-teal-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
