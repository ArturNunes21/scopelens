// Server Action timeout for createMeeting's 3 chained AI calls (GAPS.md G15).
// Originally here because page.tsx was a Client Component; it's a Server
// Component since Phase 9, but the segment-level config still applies from
// the layout, so it stays in one place. See ARCHITECTURE.md section 3.
export const maxDuration = 60;

export default function NewMeetingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
