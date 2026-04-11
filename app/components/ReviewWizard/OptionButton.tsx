"use client";

export default function OptionButton({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
        selected
          ? "bg-[#e04c8a] text-white border-[#e04c8a]"
          : "bg-[#1c1826] text-[#cbc5d9] border-[#2a2535] hover:border-[#3a3348] disabled:opacity-40"
      }`}
    >
      {children}
    </button>
  );
}
