import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import {
  Fragment,
  useEffect,
  useState,
} from "react";

import {
  authenticate,
} from "../shopify.server";

import {
  getTicketSales,
} from "../services/productionDashboard.server";

import {
  receiveCheck,
} from "../services/queue.server";


// ======================================
// LOADER
// ======================================

export const loader = async ({
  request,
}) => {
  await authenticate.admin(request);

  return {
  sales:
    await getTicketSales(
      undefined,
      {
        checkInOpenOnly: true,
      },
    ),
};
};


// ======================================
// ACTION
// ======================================

export const action = async ({
  request,
}) => {
  const { admin } =
    await authenticate.admin(
      request,
    );

  const formData =
    await request.formData();

  const intent =
    formData.get("intent");


  // ======================================
  // EDIT TICKET ORDER
  // ======================================

  if (intent === "edit-order") {
    const reservationId =
      String(
        formData.get(
          "reservationId",
        ) ?? "",
      ).trim();

    const account =
      String(
        formData.get(
          "account",
        ) ?? "",
      ).trim();

    if (
      !reservationId ||
      (account !== "FW" &&
        account !== "PM")
    ) {
      return {
        ok: false,
        intent: "edit-order",
        error:
          "Reservation and studio are required.",
      };
    }

    const quantities = {};

    for (
      const [key, value] of
      formData.entries()
    ) {
      if (
        !key.startsWith(
          "quantity:",
        )
      ) {
        continue;
      }

      const showId =
        key.slice(
          "quantity:".length,
        );

      const quantity =
        Number(value);

      if (
        !showId ||
        !Number.isInteger(
          quantity,
        ) ||
        quantity < 0
      ) {
        return {
          ok: false,
          intent: "edit-order",
          error:
            "Ticket quantities must be whole numbers of zero or greater.",
        };
      }

      quantities[showId] =
        quantity;
    }

    try {
      const {
        updateTicketOrder,
      } = await import(
        "../services/ticketOrderEditor.server"
      );

      await updateTicketOrder({
        reservationId,
        account,
        quantities,
      });

      return {
        ok: true,
        intent: "edit-order",
      };
    } catch (error) {
      console.error(
        "LIVE CHECK-IN EDIT ORDER FAILED",
        error,
      );

      return {
        ok: false,
        intent: "edit-order",
        error:
          error instanceof Error
            ? error.message
            : "The ticket order could not be updated.",
      };
    }
  }


  // ======================================
  // RECEIVE PAYMENT
  // ======================================

  if (
    intent ===
    "receive-payment"
  ) {
    const reservationId =
      String(
        formData.get(
          "reservationId",
        ) ?? "",
      ).trim();

    const showId =
      String(
        formData.get(
          "showId",
        ) ?? "",
      ).trim();

    const account =
      String(
        formData.get(
          "account",
        ) ?? "",
      ).trim();

    if (
      !reservationId ||
      !showId ||
      !account
    ) {
      throw new Response(
        "Reservation, show, and studio are required.",
        {
          status: 400,
        },
      );
    }

    if (
      account !== "FW" &&
      account !== "PM"
    ) {
      throw new Response(
        "Invalid studio account.",
        {
          status: 400,
        },
      );
    }

    await receiveCheck({
      reservationId,
      showId,
      checkNumber: "",
      admin,
      account,
    });

    return redirect(
      "/app/live-checkin",
    );
  }


  throw new Response(
    "Invalid action.",
    {
      status: 400,
    },
  );
};


// ======================================
// PAGE
// ======================================

export default function LiveCheckInPage() {
  const { sales } =
    useLoaderData();

  const actionData =
    useActionData();

  const navigation =
    useNavigation();

  const [
    editingOrderId,
    setEditingOrderId,
  ] = useState(null);

  const receivingPaymentId =
    navigation.formData?.get(
      "reservationId",
    );

  const receivingShowId =
    navigation.formData?.get(
      "showId",
    );

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData?.intent ===
        "edit-order"
    ) {
      setEditingOrderId(null);
    }
  }, [actionData]);


  return (
    <s-page heading="Live Check-In">
      <s-section>

        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            Show Day Dashboard
          </h2>

          <p
            style={{
              margin: 0,
              opacity: 0.7,
            }}
          >
            Watch arrivals, receive
            payments, edit ticket
            orders, and see how many
            guests are still expected.
          </p>
        </div>


        {actionData?.error && (
          <div
            style={{
              marginBottom: "18px",
              padding: "12px 14px",
              border:
                "1px solid #d72c0d",
              borderRadius: "10px",
            }}
          >
            <strong>
              Could not update order:
            </strong>{" "}
            {actionData.error}
          </div>
        )}


        {sales.shows.length === 0 ? (
          <p>
            No ticketed performances
            found.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "18px",
            }}
          >
            {sales.shows.map(
              (show) => {
                const showCustomers =
                  sales.customers
                    .map(
                      (customer) => {
                        const customerShow =
                          customer.shows.find(
                            (item) =>
                              item.showId ===
                              show.id,
                          );

                        if (
                          !customerShow
                        ) {
                          return null;
                        }

                        return {
                          ...customer,

                          quantity:
                            customerShow.quantity,

                          checkedIn:
                            customerShow.checkedIn,

                          stillExpected:
                            customerShow.stillExpected,

                          paymentNeeded:
                            customerShow.paymentNeeded,

                          ticketAmount:
                            customerShow.ticketAmount,
                        };
                      },
                    )
                    .filter(Boolean)
                    .sort((a, b) => {
  const getLastName = (
    name,
  ) => {
    const parts = String(
      name ?? "",
    )
      .trim()
      .split(/\s+/);

    return (
      parts[
        parts.length - 1
      ] ?? ""
    ).toLowerCase();
  };

  const lastNameA =
    getLastName(
      a.customerName,
    );

  const lastNameB =
    getLastName(
      b.customerName,
    );

  const lastNameCompare =
    lastNameA.localeCompare(
      lastNameB,
    );

  if (lastNameCompare !== 0) {
    return lastNameCompare;
  }

  return a.customerName.localeCompare(
    b.customerName,
  );
});


                return (
                  <div
                    key={show.id}
                    style={{
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "16px",
                      padding: "20px",
                    }}
                  >
                    <div
                      style={{
                        marginBottom:
                          "18px",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                        }}
                      >
                        {
                          show.performanceName
                        }
                      </h2>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "18px",
                          fontWeight:
                            "600",
                        }}
                      >
                        {show.name}
                      </div>
                    </div>


                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "12px",
                        marginBottom:
                          "24px",
                      }}
                    >
                      <StatCard
                        label="Tickets Sold"
                        value={
                          show.ticketsSold
                        }
                      />

                      <StatCard
                        label="Checked In"
                        value={
                          show.checkedIn
                        }
                      />

                      <StatCard
                        label="Still Expected"
                        value={
                          show.stillExpected
                        }
                      />

                      <StatCard
                        label="Capacity"
                        value={
                          show.capacity
                        }
                      />
                    </div>


                    <div
                      style={{
                        overflowX:
                          "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse:
                            "collapse",
                        }}
                      >
                        <thead>
                          <tr>
                            <TableHeader>
                              Customer
                            </TableHeader>

                            <TableHeader>
                              Studio
                            </TableHeader>

                            <TableHeader>
                              Expected
                            </TableHeader>

                            <TableHeader>
                              Checked In
                            </TableHeader>

                            <TableHeader>
                              Still Expected
                            </TableHeader>

                            <TableHeader>
                              Status
                            </TableHeader>

                            <TableHeader>
                              Actions
                            </TableHeader>
                          </tr>
                        </thead>


                        <tbody>
                          {showCustomers.map(
                            (customer) => {
                              const fullyArrived =
                                customer.stillExpected ===
                                0;

                              const partiallyArrived =
                                customer.checkedIn >
                                  0 &&
                                !fullyArrived;

                              const paymentNeeded =
                                customer.paymentNeeded;

                              const isReceivingPayment =
                                navigation.state ===
                                  "submitting" &&
                                receivingPaymentId ===
                                  customer.id &&
                                receivingShowId ===
                                  show.id;


                              return (
                                <Fragment
                                  key={`${show.id}-${customer.id}`}
                                >
                                  <tr>
                                    <TableCell>
                                      <strong>
                                        {
                                          customer.customerName
                                        }
                                      </strong>
                                    </TableCell>

                                    <TableCell>
                                      {
                                        customer.account
                                      }
                                    </TableCell>

                                    <TableCell>
                                      {
                                        customer.quantity
                                      }
                                    </TableCell>

                                    <TableCell>
                                      {
                                        customer.checkedIn
                                      }
                                    </TableCell>

                                    <TableCell>
                                      <strong>
                                        {
                                          customer.stillExpected
                                        }
                                      </strong>
                                    </TableCell>

                                    <TableCell>
                                      {paymentNeeded
                                        ? "Payment Needed"
                                        : fullyArrived
                                          ? "All Arrived"
                                          : partiallyArrived
                                            ? "Partially Arrived"
                                            : "Not Arrived"}
                                    </TableCell>

                                    <TableCell>
                                      <div
                                        style={{
                                          display:
                                            "flex",
                                          gap: "8px",
                                          alignItems:
                                            "center",
                                        }}
                                      >
                                        {paymentNeeded &&
                                          customer.paymentMethod ===
                                            "CHECK" && (
                                            <Form method="post">
                                              <input
                                                type="hidden"
                                                name="intent"
                                                value="receive-payment"
                                              />

                                              <input
                                                type="hidden"
                                                name="reservationId"
                                                value={
                                                  customer.id
                                                }
                                              />

                                              <input
                                                type="hidden"
                                                name="showId"
                                                value={
                                                  show.id
                                                }
                                              />

                                              <input
                                                type="hidden"
                                                name="account"
                                                value={
                                                  customer.account
                                                }
                                              />

                                              <s-button
                                                type="submit"
                                                variant="primary"
                                                disabled={
                                                  isReceivingPayment
                                                }
                                                loading={
                                                  isReceivingPayment
                                                }
                                              >
                                                {isReceivingPayment
                                                  ? "Receiving..."
                                                  : `Receive $${customer.ticketAmount.toFixed(
                                                      2,
                                                    )}`}
                                              </s-button>
                                            </Form>
                                          )}

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingOrderId(
                                              editingOrderId ===
                                                customer.id
                                                ? null
                                                : customer.id,
                                            )
                                          }
                                          style={{
                                            padding:
                                              "9px 14px",
                                            fontWeight:
                                              "600",
                                            cursor:
                                              "pointer",
                                            whiteSpace:
                                              "nowrap",
                                          }}
                                        >
                                          {editingOrderId ===
                                          customer.id
                                            ? "Close"
                                            : "Edit Order"}
                                        </button>
                                      </div>
                                    </TableCell>
                                  </tr>


                                  {editingOrderId ===
                                    customer.id && (
                                    <tr>
                                      <td
                                        colSpan={7}
                                        style={{
                                          padding:
                                            "0 10px 18px",
                                          borderBottom:
                                            "1px solid #eee",
                                        }}
                                      >
                                        <Form
                                          method="post"
                                          style={{
                                            marginTop:
                                              "10px",
                                            border:
                                              "1px solid #ddd",
                                            borderRadius:
                                              "12px",
                                            padding:
                                              "16px",
                                            background:
                                              "#fafafa",
                                          }}
                                        >
                                          <input
                                            type="hidden"
                                            name="intent"
                                            value="edit-order"
                                          />

                                          <input
                                            type="hidden"
                                            name="reservationId"
                                            value={
                                              customer.id
                                            }
                                          />

                                          <input
                                            type="hidden"
                                            name="account"
                                            value={
                                              customer.account
                                            }
                                          />

                                          <h3
                                            style={{
                                              marginTop: 0,
                                              marginBottom:
                                                "6px",
                                            }}
                                          >
                                            Edit{" "}
                                            {
                                              customer.customerName
                                            }
                                          </h3>

                                          <p
                                            style={{
                                              marginTop: 0,
                                              marginBottom:
                                                "16px",
                                              opacity: 0.7,
                                            }}
                                          >
                                            Change the
                                            number of
                                            tickets for
                                            any show.
                                          </p>


                                          <div
                                            style={{
                                              display:
                                                "grid",
                                              gap: "12px",
                                            }}
                                          >
                                            {sales.shows
                                              .filter(
                                                (
                                                  salesShow,
                                                ) =>
                                                  salesShow.performanceId ===
                                                  customer.performanceId,
                                              )
                                              .map(
                                                (
                                                  salesShow,
                                                ) => {
                                                  const existingShow =
                                                    customer.shows.find(
                                                      (
                                                        customerShow,
                                                      ) =>
                                                        customerShow.showId ===
                                                        salesShow.id,
                                                    );

                                                  const currentQuantity =
                                                    existingShow
                                                      ?.quantity ??
                                                    0;

                                                  return (
                                                    <div
                                                      key={
                                                        salesShow.id
                                                      }
                                                      style={{
                                                        display:
                                                          "grid",
                                                        gridTemplateColumns:
                                                          "1fr 110px",
                                                        gap: "16px",
                                                        alignItems:
                                                          "center",
                                                      }}
                                                    >
                                                      <div>
                                                        <strong>
                                                          {
                                                            salesShow.name
                                                          }
                                                        </strong>

                                                        <div
                                                          style={{
                                                            marginTop:
                                                              "3px",
                                                            fontSize:
                                                              "13px",
                                                            opacity:
                                                              0.7,
                                                          }}
                                                        >
                                                          Currently{" "}
                                                          {
                                                            currentQuantity
                                                          }{" "}
                                                          ticket
                                                          {currentQuantity ===
                                                          1
                                                            ? ""
                                                            : "s"}
                                                        </div>
                                                      </div>

                                                      <input
                                                        type="number"
                                                        name={`quantity:${salesShow.id}`}
                                                        min="0"
                                                        step="1"
                                                        defaultValue={
                                                          currentQuantity
                                                        }
                                                        required
                                                        style={{
                                                          width:
                                                            "100%",
                                                          padding:
                                                            "9px",
                                                          boxSizing:
                                                            "border-box",
                                                        }}
                                                      />
                                                    </div>
                                                  );
                                                },
                                              )}
                                          </div>


                                          <div
                                            style={{
                                              marginTop:
                                                "18px",
                                              display:
                                                "flex",
                                              gap: "10px",
                                              justifyContent:
                                                "flex-end",
                                            }}
                                          >
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditingOrderId(
                                                  null,
                                                )
                                              }
                                            >
                                              Cancel
                                            </button>

                                            <button
                                              type="submit"
                                              style={{
                                                fontWeight:
                                                  "600",
                                                cursor:
                                                  "pointer",
                                              }}
                                            >
                                              Save Changes
                                            </button>
                                          </div>
                                        </Form>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
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


// ======================================
// COMPONENTS
// ======================================

function StatCard({
  label,
  value,
}) {
  return (
    <div
      style={{
        border:
          "1px solid #ddd",
        borderRadius: "12px",
        padding: "16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "36px",
          fontWeight: "700",
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "14px",
          fontWeight: "600",
          opacity: 0.7,
        }}
      >
        {label}
      </div>
    </div>
  );
}


function TableHeader({
  children,
}) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px",
        borderBottom:
          "2px solid #ddd",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}


function TableCell({
  children,
}) {
  return (
    <td
      style={{
        padding: "12px 10px",
        borderBottom:
          "1px solid #eee",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}