import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (notifications.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Notifications</h1>
      <div className="mt-6 flex flex-col gap-3">
        {notifications.map((n) => (
          <div key={n.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <p className="font-medium text-zinc-900">{n.title}</p>
            <p className="text-sm text-zinc-600">{n.body}</p>
            <p className="mt-1 text-xs text-zinc-400">{n.createdAt.toLocaleString("en-IN")}</p>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-zinc-500">No notifications yet.</p>}
      </div>
    </main>
  );
}
