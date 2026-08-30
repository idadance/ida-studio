import {
  Form,
  redirect,
  useLoaderData,
  useNavigation,
} from "react-router";

import { authenticate } from "../shopify.server";
import { getReadyToSendQueue } from "../services/productionDashboard.server";
import { sendReservationTickets } from "../services/ticketDelivery.server";

function getAccountFromShop(shop) {
  if (
    shop ===
    "ida-dance-store.myshopify.com"
  ) {
    return "FW";
  }

  if (
    shop ===
    "ida-dance-store-pm.myshopify.com"
  ) {
    return "PM";
  }

  throw new Error(
    "This Shopify store is not recognized as an IDA studio.",
  );
}

export const loader = async ({
  request,
}) => {
  const { session } =
    await authenticate.admin(request);

  const account =
    getAccountFromShop(
      session.shop,
    );

  return {
    account,

    readyToSend:
      await getReadyToSendQueue(
        account,
      ),
  };
};

export const action = async ({
  request,
}) => {
  const { session } =
    await authenticate.admin(request);

  const account =
    getAccountFromShop(
      session.shop,
    );

  const formData =
    await request.formData();

  const reservationId =
    formData.get(
      "reservationId",
    );

  if (!reservationId) {
    throw new Response(
      "Reservation ID is required.",
      {
        status: 400,
      },
    );
  }

  await sendReservationTickets({
    reservationId:
      String(reservationId),

    account,
  });

  return redirect(
    "/app/ready-to-send",
  );
};

export default function ReadyToSendPage() {
  const {
    readyToSend,
    account,
  } = useLoaderData();

  const navigation =
    useNavigation();

  const sendingReservationId =
    navigation.formData?.get(
      "reservationId",
    );

  const studioName =
    account === "FW"
      ? "Fort Washington"
      : "Plymouth Meeting";

  return (
    <s-page heading="Ready to Send">
      <s-section>
        <p>
          <strong>
            {studioName}
          </strong>
        </p>

        <p>
          These customers have
          confirmed tickets but have
          not yet received their ticket
          folder email.
        </p>

        {readyToSend.length === 0 ? (
          <p>
            🎉 Everyone&apos;s tickets
            have been sent!
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            {readyToSend.map(
              (customer) => {
                const isSending =
                  navigation.state ===
                    "submitting" &&
                  sendingReservationId ===
                    customer.id;

                return (
                  <div
                    key={customer.id}
                    style={{
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "12px",
                      padding: "16px",
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                        marginBottom:
                          "8px",
                      }}
                    >
                      {
                        customer.customerName
                      }
                    </h3>

                    <p>
                      {
                        customer.customerEmail
                      }
                    </p>

                    <p>
                      <strong>
                        {
                          customer.performance
                        }
                      </strong>
                    </p>

                    <p>
                      {customer.shows.join(
                        ", ",
                      )}
                    </p>

                    <p>
                      🎟{" "}
                      {customer.tickets}{" "}
                      Ticket
                      {customer.tickets ===
                      1
                        ? ""
                        : "s"}
                    </p>

                    <p>
                      Payment:{" "}
                      {customer.paymentMethod ===
                      "CREDIT_CARD"
                        ? "Credit Card"
                        : "Check"}
                    </p>

                    {customer.driveFolderLink ? (
                      <>
                        <p>
                          ✅ Google Drive
                          folder ready
                        </p>

                        <Form method="post">
                          <input
                            type="hidden"
                            name="reservationId"
                            value={
                              customer.id
                            }
                          />

                          <s-button
                            type="submit"
                            variant="primary"
                            disabled={
                              isSending
                            }
                            loading={
                              isSending
                            }
                          >
                            {isSending
                              ? "Sending Tickets..."
                              : "Send Tickets"}
                          </s-button>
                        </Form>
                      </>
                    ) : (
                      <p>
                        ⚠️ Google Drive
                        folder missing —
                        tickets cannot be
                        sent.
                      </p>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </s-section>
    </s-page>
  );
}