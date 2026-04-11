"use client";

export default function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-[#4a3828]/50 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-[#f5ddc0] flex flex-col max-h-[92vh]">
        {children}
      </div>
    </div>
  );
}
