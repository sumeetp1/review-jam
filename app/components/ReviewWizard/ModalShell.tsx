"use client";

export default function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {children}
      </div>
    </div>
  );
}
