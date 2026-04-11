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
          ? "bg-[#4a3828] text-white border-[#4a3828]"
          : "bg-white text-[#5c4a38] border-[#f5ddc0] hover:border-[#d4b896] disabled:opacity-40"
      }`}
    >
      {children}
    </button>
  );
}
