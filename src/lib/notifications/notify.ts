import "server-only";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import type { NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  /** Also attempt to email this notification, if an email provider is configured. */
  email?: string;
};

/**
 * Basic notification abstraction: every notification is always persisted
 * in-app (Notification table). If RESEND_API_KEY is configured, it is also
 * emailed via the Resend HTTP API; otherwise the email is logged to the
 * server console so nothing is silently dropped in development.
 */
export async function notify(input: NotifyInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      meta: (input.meta as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });

  if (input.email) {
    await sendEmail({ to: input.email, subject: input.title, body: input.body });
  }

  return notification;
}

async function sendEmail(params: { to: string; subject: string; body: string }) {
  if (!config.notifications.emailConfigured) {
    console.log(`[notifications] (email disabled) to=${params.to} subject="${params.subject}"`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.notifications.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.notifications.fromEmail,
      to: params.to,
      subject: params.subject,
      text: params.body,
    }),
  });

  if (!response.ok) {
    console.error(`[notifications] Failed to send email to ${params.to}: ${await response.text()}`);
  }
}
