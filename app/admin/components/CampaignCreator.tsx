"use client";

import { useState } from "react";
import { collection, addDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function CampaignCreator() {
  const [newProdName, setNewProdName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandEmail, setNewBrandEmail] = useState("");
  const [newCategory, setNewCategory] = useState("Tech");
  const [newCampaignId, setNewCampaignId] = useState("");
  const [endDateLocal, setEndDateLocal] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [variantRows, setVariantRows] = useState<string[]>([""]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const universalEndDate = new Date(endDateLocal).toISOString();

      const productRef = await addDoc(collection(db, "products"), {
        name: newProdName,
        brandName: newBrandName,
        brandEmail: newBrandEmail.trim().toLowerCase(),
        category: newCategory,
        campaignId: newCampaignId || `camp_${Date.now()}`,
        endDate: universalEndDate,
        description: newDescription.trim(),
        budget: newBudget ? Number(newBudget) : null,
        createdAt: new Date().toISOString(),
      });

      // Write variants to subcollection
      const validVariants = variantRows.map((v) => v.trim()).filter(Boolean);
      if (validVariants.length > 0) {
        const batch = writeBatch(db);
        for (const name of validVariants) {
          const variantRef = doc(collection(db, "products", productRef.id, "productVariants"));
          batch.set(variantRef, { name, createdAt: new Date().toISOString() });
        }
        await batch.commit();
      }

      alert(`Campaign Created Successfully! ${validVariants.length > 0 ? `${validVariants.length} variant(s) added.` : ""} It is now live on the homepage.`);
      setNewProdName(""); setNewBrandName(""); setNewBrandEmail(""); setNewCampaignId(""); setEndDateLocal(""); setNewDescription(""); setNewBudget("");
      setVariantRows([""]);
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🚀 Launch New Campaign</h2>
      <form onSubmit={handleCreateCampaign} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-400 mb-1">Product Name</label>
          <input type="text" required value={newProdName} onChange={e => setNewProdName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Brand Name</label>
            <input type="text" required value={newBrandName} onChange={e => setNewBrandName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Category</label>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none">
              <option value="Tech">Tech</option>
              <option value="Home">Home</option>
              <option value="SaaS">SaaS</option>
              <option value="Beauty">Beauty</option>
              <option value="Gaming">Gaming</option>
              <option value="Automotive">Automotive</option>
              <option value="Fitness">Fitness</option>
              <option value="Travel">Travel</option>
              <option value="Finance">Finance</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Brand Email (for dashboard access)</label>
            <input type="email" value={newBrandEmail} onChange={e => setNewBrandEmail(e.target.value)} placeholder="brand@company.com" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Pool Budget ($)</label>
            <input type="number" value={newBudget} onChange={e => setNewBudget(e.target.value)} placeholder="e.g. 500" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-400 mb-1">Campaign Description (shown to applicants)</label>
          <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="What reviewers should know about this product…" rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Campaign ID</label>
            <input type="text" required value={newCampaignId} onChange={e => setNewCampaignId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" placeholder="e.g. camp_123" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">End Date & Time</label>
            <input type="datetime-local" required value={endDateLocal} onChange={e => setEndDateLocal(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
          </div>
        </div>
        {/* Variants / SKUs */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-bold text-slate-400">
              Variants / SKUs{" "}
              <span className="font-normal text-slate-500 text-xs">(optional — e.g. "Black 256GB", "Blue 128GB")</span>
            </label>
            <button
              type="button"
              onClick={() => setVariantRows((rows) => [...rows, ""])}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              + Add variant
            </button>
          </div>
          <div className="space-y-2">
            {variantRows.map((v, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={v}
                  onChange={(e) => setVariantRows((rows) => rows.map((r, i) => (i === idx ? e.target.value : r)))}
                  placeholder={`Variant ${idx + 1} — e.g. Blue · 128GB`}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm placeholder-slate-600"
                />
                {variantRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setVariantRows((rows) => rows.filter((_, i) => i !== idx))}
                    className="px-3 text-slate-500 hover:text-red-400 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={isCreating} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black mt-2 hover:bg-indigo-500 transition disabled:opacity-50">
          {isCreating ? "Publishing..." : "Launch Campaign Live"}
        </button>
      </form>
    </div>
  );
}
