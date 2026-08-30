import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";

import prisma from "../db.server";

import {
  generateQRCode,
} from "../services/qr.server";

export async function loader({ params }) {
  const ticket =
    await prisma.ticketOrder.findUnique({
      where: {
        ticketCode:
          params.ticketCode,
      },

      include: {
        show: true,
        performance: true,
        reservation: true,
      },
    });

  if (!ticket) {
    throw new Response(
      "Ticket not found",
      {
        status: 404,
      },
    );
  }

  if (!ticket.reservation) {
    throw new Response(
      "Reservation not found",
      {
        status: 404,
      },
    );
  }

  const activeTickets =
    await prisma.ticketOrder.findMany({
      where: {
        reservationId:
          ticket.reservationId,

        showId:
          ticket.showId,

        status: {
          not: "CANCELED",
        },
      },

      select: {
        quantity: true,
        checkedInCount: true,
      },
    });

  const totalAdmissions =
    activeTickets.reduce(
      (sum, item) =>
        sum + item.quantity,
      0,
    );

  const checkedIn =
    activeTickets.reduce(
      (sum, item) =>
        sum +
        item.checkedInCount,
      0,
    );

  const remaining =
    Math.max(
      0,
      totalAdmissions -
        checkedIn,
    );

  const qr =
    await generateQRCode(
      ticket.ticketCode,
    );

  return {
    ticketCode:
      ticket.ticketCode,

    customerName:
      ticket.reservation.customerName,

    performanceName:
      ticket.performance.name,

    showName:
      ticket.show.name,

    totalAdmissions,
    checkedIn,
    remaining,

    checkInOpen:
      ticket.show.checkInOpen,

    programUrl:
      ticket.performance.programUrl ||
      null,

    qr,
  };
}

export default function LiveTicketPage() {
  const initialData =
    useLoaderData();

  const {
    ticketCode,
    customerName,
    performanceName,
    showName,
    qr,
  } = initialData;

  const [ticketStatus, setTicketStatus] =
    useState({
      totalAdmissions:
        initialData.totalAdmissions,

      checkedIn:
        initialData.checkedIn,

      remaining:
        initialData.remaining,

      checkInOpen:
        initialData.checkInOpen,

      fullyCheckedIn:
        initialData.remaining === 0,

      programUrl:
        initialData.programUrl,
    });

  const {
    totalAdmissions,
    checkedIn,
    remaining,
    checkInOpen,
  } = ticketStatus;

  useEffect(() => {
    let stopped = false;

    const checkStatus = async () => {
      try {
        const response =
          await fetch(
            `/api/ticket-status/${encodeURIComponent(
              ticketCode,
            )}`,
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        if (
          !stopped &&
          data.ok
        ) {
          setTicketStatus({
            totalAdmissions:
              data.totalAdmissions,

            checkedIn:
              data.checkedIn,

            remaining:
              data.remaining,

            checkInOpen:
              data.checkInOpen,

            fullyCheckedIn:
              data.fullyCheckedIn,

            programUrl:
              data.programUrl,
          });
        }
      } catch (error) {
        console.error(
          "Live ticket status check failed:",
          error,
        );
      }
    };

    checkStatus();

    const interval =
      window.setInterval(
        checkStatus,
        1500,
      );

    return () => {
      stopped = true;

      window.clearInterval(
        interval,
      );
    };
  }, [ticketCode]);

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "32px 20px 50px",
        background: "#ffffff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111111",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: "700",
            letterSpacing: "2px",
            marginBottom: "24px",
          }}
        >
          INSTITUTE OF DANCE ARTISTRY
        </div>

        <div
          style={{
            border: "1px solid #dddddd",
            borderRadius: "24px",
            padding: "30px 22px",
            boxShadow:
              "0 8px 30px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#666666",
            }}
          >
            Digital Ticket
          </div>

          <h1
            style={{
              margin: "12px 0 6px",
              fontSize: "34px",
              lineHeight: 1.1,
            }}
          >
            {performanceName}
          </h1>

          <div
            style={{
              fontSize: "22px",
              fontWeight: "600",
              marginTop: "12px",
            }}
          >
            {showName}
          </div>

          <div
            style={{
              marginTop: "28px",
              fontSize: "24px",
              fontWeight: "700",
            }}
          >
            {customerName}
          </div>

          <div
            style={{
              marginTop: "28px",
              padding: "20px",
              background: "#f6f6f7",
              borderRadius: "18px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: "700",
              }}
            >
              {totalAdmissions === 1
                ? "1 Admission"
                : `${totalAdmissions} Admissions`}
            </div>

            {checkedIn > 0 && (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "16px",
                  color: "#15803d",
                  fontWeight: "600",
                }}
              >
                {checkedIn} checked in
              </div>
            )}

            {checkedIn > 0 &&
              remaining > 0 && (
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "15px",
                    color: "#666666",
                  }}
                >
                  {remaining} remaining
                </div>
              )}
          </div>

          {remaining <= 0 ? (
            <div
              style={{
                marginTop: "32px",
                padding: "28px 22px",
                borderRadius: "18px",
                background: "#f0fdf4",
              }}
            >
              <div
                style={{
                  fontSize: "42px",
                }}
              >
                ✓
              </div>

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "26px",
                  fontWeight: "800",
                }}
              >
                You're checked in!
              </div>

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "17px",
                  color: "#555555",
                }}
              >
                Welcome to{" "}
                {performanceName}
              </div>

              {ticketStatus.programUrl && (
                <a
                  href={
                    ticketStatus.programUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    marginTop: "24px",
                    padding: "16px 20px",
                    borderRadius: "12px",
                    background: "#111111",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontSize: "18px",
                    fontWeight: "800",
                  }}
                >
                  VIEW DIGITAL PROGRAM
                </a>
              )}
            </div>
          ) : !checkInOpen ? (
            <div
              style={{
                marginTop: "32px",
                padding: "28px 22px",
                borderRadius: "18px",
                background: "#f6f6f7",
              }}
            >
              <div
                style={{
                  fontSize: "36px",
                }}
              >
                🎟
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "23px",
                  fontWeight: "800",
                }}
              >
                Check-in isn't open yet
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: "#666666",
                }}
              >
                Your check-in QR code
                will appear here when
                IDA opens check-in.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  marginTop: "28px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Hold this QR code in
                front of the check-in
                iPad
              </div>

              <img
                src={qr}
                alt="Ticket QR Code"
                style={{
                  display: "block",
                  width: "280px",
                  maxWidth: "100%",
                  height: "auto",
                  margin: "20px auto 0",
                }}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}