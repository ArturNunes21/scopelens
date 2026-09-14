"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABEL, STATUS_CLASS } from "../status";

// Subscribes to this single meeting row (ARCHITECTURE.md section 3 — no
// polling) and reacts to status changes. RLS on `meetings` still applies to
// Realtime postgres_changes, so this only ever receives rows from the
// caller's own workspace (see the enable_meetings_realtime migration).
export function MeetingStatusBadge({
  meetingId,
  initialStatus,
}: {
  meetingId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`meeting-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meetings",
          filter: `id=eq.${meetingId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          setStatus(newStatus);
          // Re-fetch the server-rendered findings/diagnosis/summary once the
          // pipeline has something new to show.
          if (newStatus === "completed" || newStatus === "failed") {
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, router]);

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_CLASS[status] ?? STATUS_CLASS.pending
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
