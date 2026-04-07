import {
  doc, getDoc, updateDoc, deleteField, addDoc, collection,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { jsonError, jsonSuccess } from "../../../lib/api";

// ─── Brand Response to Reviews ──────────────────────────────────────────────
//
// POST /api/brand-response — three actions:
//
// { action: "submit", reviewId, productId, brandEmail, body }
//   → Brand submits an official response to a review
//
// { action: "edit", reviewId, productId, brandEmail, body }
//   → Brand edits their existing response
//
// { action: "delete", reviewId, productId, brandEmail }
//   → Brand deletes their response

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── Submit a brand response ──────────────────────────────────────────
    if (action === "submit") {
      const { reviewId, productId, brandEmail, body: responseBody } = body;

      if (!reviewId || !productId || !brandEmail || !responseBody?.trim()) {
        return jsonError("reviewId, productId, brandEmail, and body are required.", 400);
      }

      // Verify brand ownership of the product
      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) {
        return jsonError("Product not found.", 404);
      }

      const product = productSnap.data();
      if (product.brandEmail?.toLowerCase() !== brandEmail.toLowerCase()) {
        return jsonError("You are not authorized to respond for this product.", 403);
      }

      // Check review exists
      const reviewRef = doc(db, "reviews", reviewId);
      const reviewSnap = await getDoc(reviewRef);
      if (!reviewSnap.exists()) {
        return jsonError("Review not found.", 404);
      }

      const review = reviewSnap.data();

      // Write brand response to review doc
      const respondedAt = new Date().toISOString();
      await updateDoc(reviewRef, {
        brandResponse: {
          body: responseBody.trim(),
          respondedBy: brandEmail.toLowerCase(),
          respondedAt,
        },
      });

      // Create notification for the reviewer
      if (review.reviewerId) {
        await addDoc(collection(db, "notifications"), {
          userId: review.reviewerId,
          type: "brand_response",
          title: "Brand responded to your review",
          body: `${product.brandName || "The brand"} responded to your review of ${product.name || "their product"}`,
          link: review.communitySlug && review.productSlug
            ? `/c/${review.communitySlug}/${review.productSlug}?review=${reviewId}`
            : `/product/${productId}?review=${reviewId}`,
          read: false,
          createdAt: respondedAt,
        });
      }

      return jsonSuccess({ message: "Response submitted successfully." });
    }

    // ── Edit a brand response ────────────────────────────────────────────
    if (action === "edit") {
      const { reviewId, productId, brandEmail, body: responseBody } = body;

      if (!reviewId || !productId || !brandEmail || !responseBody?.trim()) {
        return jsonError("reviewId, productId, brandEmail, and body are required.", 400);
      }

      // Verify brand ownership
      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) {
        return jsonError("Product not found.", 404);
      }

      const product = productSnap.data();
      if (product.brandEmail?.toLowerCase() !== brandEmail.toLowerCase()) {
        return jsonError("You are not authorized to edit this response.", 403);
      }

      // Verify review exists and has a brand response
      const reviewRef = doc(db, "reviews", reviewId);
      const reviewSnap = await getDoc(reviewRef);
      if (!reviewSnap.exists()) {
        return jsonError("Review not found.", 404);
      }

      await updateDoc(reviewRef, {
        "brandResponse.body": responseBody.trim(),
        "brandResponse.editedAt": new Date().toISOString(),
      });

      return jsonSuccess({ message: "Response updated successfully." });
    }

    // ── Delete a brand response ──────────────────────────────────────────
    if (action === "delete") {
      const { reviewId, productId, brandEmail } = body;

      if (!reviewId || !productId || !brandEmail) {
        return jsonError("reviewId, productId, and brandEmail are required.", 400);
      }

      // Verify brand ownership
      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) {
        return jsonError("Product not found.", 404);
      }

      const product = productSnap.data();
      if (product.brandEmail?.toLowerCase() !== brandEmail.toLowerCase()) {
        return jsonError("You are not authorized to delete this response.", 403);
      }

      // Delete the brand response field
      const reviewRef = doc(db, "reviews", reviewId);
      await updateDoc(reviewRef, {
        brandResponse: deleteField(),
      });

      return jsonSuccess({ message: "Response deleted successfully." });
    }

    return jsonError("Invalid action. Use 'submit', 'edit', or 'delete'.", 400);

  } catch (error) {
    console.error("Brand response error:", error);
    return jsonError("Internal server error.", 500);
  }
}
