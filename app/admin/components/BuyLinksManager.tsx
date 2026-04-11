"use client";

import { useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import type { BuyLink } from "../../../lib/types";

type ProductInfo = {
  id: string;
  name: string;
  brandName: string;
  buyLinks: BuyLink[];
};

export default function BuyLinksManager() {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formOpen, setFormOpen] = useState<string | null>(null);
  const [newRetailer, setNewRetailer] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "products"));
      const list: ProductInfo[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Untitled",
          brandName: data.brandName || "",
          buyLinks: Array.isArray(data.buyLinks) ? (data.buyLinks as BuyLink[]) : [],
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(list);
      setIsLoaded(true);
    } catch (e) {
      console.error("Failed to load products for buy links:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddLink(productId: string) {
    if (!newRetailer.trim() || !newUrl.trim()) return;
    setIsSaving(true);
    try {
      const product = products.find((p) => p.id === productId);
      const newLink: BuyLink = {
        retailer: newRetailer.trim(),
        url: newUrl.trim(),
        price: newPrice.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      const updated = [...(product?.buyLinks || []), newLink];
      await updateDoc(doc(db, "products", productId), { buyLinks: updated });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, buyLinks: updated } : p))
      );
      setNewRetailer("");
      setNewUrl("");
      setNewPrice("");
      setFormOpen(null);
    } catch (e) {
      console.error("Failed to add buy link:", e);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveLink(productId: string, index: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const updated = product.buyLinks.filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, "products", productId), { buyLinks: updated });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, buyLinks: updated } : p))
      );
    } catch (e) {
      console.error("Failed to remove buy link:", e);
    }
  }

  return (
    <div className="bg-[#1c1826] p-6 rounded-3xl border border-[#2a2535] mt-8 shadow-lg">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-[#e8e4f0] flex items-center gap-2">🛒 Retailer Buy Links</h2>
        {!isLoaded && (
          <button
            type="button"
            onClick={loadProducts}
            disabled={isLoading}
            className="text-sm font-bold text-[#f472b6] hover:text-[#f9a8d4] transition disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load Products"}
          </button>
        )}
      </div>
      <p className="text-[#8b839e] text-sm mb-4">
        Manage where-to-buy links for any product. These appear on each product&apos;s hub page.
      </p>

      {!isLoaded ? (
        <p className="text-[#8b839e] text-sm">Click &quot;Load Products&quot; to manage buy links.</p>
      ) : products.length === 0 ? (
        <p className="text-[#8b839e] text-sm">No products found.</p>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {products.map((product) => (
            <div key={product.id} className="bg-[#1c1826]/50 rounded-xl border border-[#2a2535]/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-[#e8e4f0]">{product.name}</p>
                  <p className="text-[11px] text-[#8b839e]">{product.brandName}</p>
                </div>
                <span className="text-[10px] text-[#8b839e] font-mono">{product.buyLinks.length} link{product.buyLinks.length !== 1 ? "s" : ""}</span>
              </div>

              {product.buyLinks.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {product.buyLinks.map((link, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#1c1826] rounded-lg px-3 py-2 border border-[#2a2535]">
                      <div className="min-w-0 flex-1">
                        <span className="text-[12px] font-semibold text-[#cbc5d9]">{link.retailer}</span>
                        {link.price && <span className="ml-2 text-[11px] text-[#6ee7b7] font-medium">{link.price}</span>}
                        <p className="text-[10px] text-[#8b839e] truncate">{link.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(product.id, i)}
                        className="ml-2 text-[11px] text-[#f87171] hover:text-[#fca5a5] font-semibold transition shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {formOpen === product.id ? (
                <div className="space-y-2 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newRetailer}
                      onChange={(e) => setNewRetailer(e.target.value)}
                      placeholder="Retailer name"
                      className="w-full bg-[#1c1826] border border-[#2a2535] rounded-xl p-2.5 text-[#e8e4f0] text-[12px] outline-none focus:border-[#f472b6] transition placeholder:text-[#4a4458]"
                    />
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[#1c1826] border border-[#2a2535] rounded-xl p-2.5 text-[#e8e4f0] text-[12px] outline-none focus:border-[#f472b6] transition placeholder:text-[#4a4458]"
                    />
                    <input
                      type="text"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="$29.99 (optional)"
                      className="w-full bg-[#1c1826] border border-[#2a2535] rounded-xl p-2.5 text-[#e8e4f0] text-[12px] outline-none focus:border-[#f472b6] transition placeholder:text-[#4a4458]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddLink(product.id)}
                      disabled={isSaving || !newRetailer.trim() || !newUrl.trim()}
                      className="text-[11px] font-bold px-4 py-2 rounded-xl bg-[#e04c8a] hover:bg-[#d84315] disabled:opacity-50 text-white transition"
                    >
                      {isSaving ? "Saving..." : "Save Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormOpen(null); setNewRetailer(""); setNewUrl(""); setNewPrice(""); }}
                      className="text-[11px] font-medium px-4 py-2 rounded-xl text-[#8b839e] hover:text-[#e8e4f0] hover:bg-[#231e2e] transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setFormOpen(product.id); setNewRetailer(""); setNewUrl(""); setNewPrice(""); }}
                  className="text-[11px] font-bold text-[#f472b6] hover:text-[#f9a8d4] transition"
                >
                  + Add Link
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
