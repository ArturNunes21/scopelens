// Route segment config only applies from a Server Component — `page.tsx` in
// this segment is "use client", so the Server Action timeout (GAPS.md G15)
// has to be set here instead. See ARCHITECTURE.md section 3.
export const maxDuration = 60;

export default function NewMeetingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
