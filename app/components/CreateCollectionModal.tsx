"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

type ProductOption = {
  id: string;
  name: string;
  brandName: string;
  category: string;
};

export default function CreateCollectionModal({ isOpen, onClose, userId, userName }: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load all products for search
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const items: ProductOption[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          brandName: d.data().brandName,
          category: d.data().category,
        }));
        setAllProducts(items.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        /* ignore */
      }
    })();
  }, [isOpen]);

  const filteredProducts = searchQuery.trim()
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brandName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allProducts;

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter a collection name.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Select at least 1 product.");
      return;
    }

    setSubmitting(true);
    try {
      const generatedSlug = slugify(name.trim());

      // Check slug uniqueness
      const existing = await getDocs(
        query(collection(db, "collections"), where("slug", "==", generatedSlug))
      );
      if (!existing.empty) {
        setError(`A collection with slug "${generatedSlug}" already exists.`);
        setSubmitting(false);
        return;
      }

      await addDoc(collection(db, "collections"), {
        name: name.trim(),
        slug: generatedSlug,
        emoji: emoji.trim() || "📦",
        description: description.trim(),
        productIds: Array.from(selectedIds),
        creatorId: userId,
        creatorName: userName,
        isOfficial: false,
        createdAt: new Date().toISOString(),
      });

      // Reset and close
      setName("");
      setEmoji("");
      setDescription("");
      setSelectedIds(new Set());
      setSearchQuery("");
      onClose();

      // Reload page to show new collection
      window.location.href = "/collections";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create collection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedProducts = allProducts.filter((p) => selectedIds.has(p.id));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#1c1826] rounded-2xl w-full max-w-lg border border-[#2a2535] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2535] shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#e8e4f0]">
              Create Collection
            </h2>
            <p className="text-[11px] text-[#8b839e] mt-0.5">
              Curate a list of products for the community
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8b839e] hover:text-[#e8e4f0] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#231e2e] transition text-lg leading-none"
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8b839e] block mb-1.5">
              Collection Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Best Headphones of 2026"
              className="w-full text-sm bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500/40 text-[#e8e4f0] placeholder:text-[#4a4458]"
            />
          </div>

          {/* Emoji */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8b839e] block mb-1.5">
              Emoji
            </label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              placeholder="🎧"
              className="w-20 text-sm bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500/40 text-center"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8b839e] block mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What makes this collection special?"
              className="w-full text-sm bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500/40 text-[#e8e4f0] placeholder:text-[#4a4458] resize-none"
            />
          </div>

          {/* Selected products */}
          {selectedProducts.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8b839e] block mb-1.5">
                Selected ({selectedProducts.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className="flex items-center gap-1 text-[11px] font-medium bg-[#e04c8a]/12 text-[#e04c8a] px-2.5 py-1 rounded-full border border-[#e04c8a]/20 hover:bg-[#e04c8a]/20 transition"
                  >
                    {p.name}
                    <span className="text-[#f472b6]">&#10005;</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product search */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8b839e] block mb-1.5">
              Add Products
            </label>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full text-sm bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500/40 text-[#e8e4f0] placeholder:text-[#4a4458]"
            />
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#2a2535]">
              {filteredProducts.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-[#8b839e]">
                  {searchQuery ? "No products match your search." : "No products found."}
                </p>
              ) : (
                filteredProducts.slice(0, 20).map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 text-[12px] border-b border-[#2a2535] last:border-b-0 transition ${
                        isSelected
                          ? "bg-[#e04c8a]/12 text-[#e04c8a]"
                          : "text-[#cbc5d9] hover:bg-[#231e2e]"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-[#e04c8a] border-[#e04c8a] text-white"
                          : "border-[#3a3348]"
                      }`}>
                        {isSelected && <span className="text-[10px]">&#10003;</span>}
                      </span>
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-[11px] text-[#8b839e] shrink-0">{p.brandName}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && <p className="text-[12px] text-[#fca5a5]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2a2535] shrink-0 flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-950/300 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
          >
            {submitting ? (
              <>
                <span className="animate-spin text-base">&#10227;</span> Creating...
              </>
            ) : (
              "Create Collection"
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 text-sm text-[#8b839e] border border-[#2a2535] rounded-xl hover:bg-[#231e2e] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
