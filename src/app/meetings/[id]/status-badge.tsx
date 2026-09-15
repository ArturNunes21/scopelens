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

  // router.refresh() intentionally preserves this component's local state
  // (that's the whole point — it's what lets the Realtime-driven `status`
  // survive a refresh without flashing). But that means the reverse never
  // happens on its own: if a server-fetched initialStatus ever arrives
  // ahead of (or instead of) this component's own Realtime event — a missed
  // event, the server action's own implicit post-mutation refresh, a plain
  // page reload — local state can drift from the authoritative DB value.
  // Re-sync during render when the server hands us a new initialStatus
  // (React's documented "adjusting state when a prop changes" pattern —
  // https://react.dev/learn/you-might-not-need-an-effect — not an effect,
  // since setState-in-effect is exactly the cascading-render anti-pattern
  // that pattern exists to avoid).
  const [prevInitialStatus, setPrevInitialStatus] = useState(initialStatus);
  if (initialStatus !== prevInitialStatus) {
    setPrevInitialStatus(initialStatus);
    setStatus(initialStatus);
  }

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
          // Re-fetch the server-rendered body on every transition, not just
          // the terminal ones — e.g. failed -> processing (via Retry) must
          // also re-render so the stale error message + Retry button (from
          // the initial server render) disappear immediately, instead of
          // staying clickable while a run is genuinely in flight.
          router.refresh();
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
