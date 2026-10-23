import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const reviews = await prisma.sixersPaymentReview.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { reviews };
};

export default function SixersPaymentReviewsPage() {
  const { reviews } = useLoaderData();

  return (
    <s-page heading="Sixers Payment Reviews">
      <s-section>
        <p>
          Shopify payments requiring manual review. These orders have
          not been automatically confirmed as Sixers reservations.
        </p>

        {reviews.length === 0 ? (
          <p>No payment reviews found.</p>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              <strong>
                {review.shopifyOrderNumber || review.shopifyOrderId}
              </strong>
              <div>Store: {review.shop}</div>
              <div>Reason: {review.reason}</div>
              <div>Status: {review.status}</div>
              <div>
                Reservation ID: {review.reservationId || "Not linked"}
              </div>
              <div>
                Flagged: {new Date(review.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </s-section>
    </s-page>
  );
}
