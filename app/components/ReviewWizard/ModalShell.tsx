"use client";

export default function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-[#1c1826] rounded-xl max-w-lg w-full shadow-lg border border-[#2a2535] flex flex-col max-h-[92vh]">
        {children}
      </div>
    </div>
  );
}
