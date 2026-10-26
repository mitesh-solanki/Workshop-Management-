export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background">
      {children}
    </div>
  );
}
