import { Form, redirect, useLoaderData } from "react-router";
import prisma from "../db.server";
import TicketInfo from "../components/checkin/TicketInfo";
import StatusBanner from "../components/checkin/StatusBanner";
import CheckInButton from "../components/checkin/CheckInButton";

export async function action({ params }) {
  const ticket = await prisma.ticketOrder.findUnique({
    where: {
      ticketCode: params.ticketCode,
    },
  });

  if (!ticket) {
    throw new Response("Ticket not found", {
      status: 404,
    });
  }

  if (ticket.checkedInCount >= ticket.quantity) {
    return {
      success: false,
      message: "Ticket already fully checked in.",
    };
  }

  await prisma.ticketOrder.update({
    where: {
      id: ticket.id,
    },
    data: {
      checkedInCount: {
        increment: 1,
      },
    },
  });

  return redirect(`/checkin/${params.ticketCode}`);
}

export async function loader({ params }) {
  console.log("🔥 CHECKIN LOADER RUNNING");

  const ticket = await prisma.ticketOrder.findUnique({
    where: {
      ticketCode: params.ticketCode,
    },
    include: {
      show: true,
      performance: true,
      reservation: true,
    },
  });

  if (!ticket) {
    throw new Response("Ticket not found", {
      status: 404,
    });
  }

  return { ticket };
}

export default function CheckInPage() {
  const { ticket } = useLoaderData();
 const remaining =
  ticket.quantity - ticket.checkedInCount;

const fullyCheckedIn = remaining <= 0;

const partiallyCheckedIn =
  ticket.checkedInCount > 0 &&
  !fullyCheckedIn;

  return (
    <main
      style={{
        maxWidth: 700,
        margin: "60px auto",
        fontFamily: "system-ui",
        padding: 24,
      }}
    >
      <h1>🎟 Ticket Check-In</h1>

      <hr />

      <TicketInfo ticket={ticket} />

      <div
  style={{
    marginTop: 50,
    textAlign: "center",
  }}
>
  {fullyCheckedIn ? (
    <>
      <StatusBanner status="used" />

      <h2>
        {ticket.checkedInCount} of {ticket.quantity} Used
      </h2>
    </>
  ) : (
    <>
      <StatusBanner
  status={
    partiallyCheckedIn
      ? "partial"
      : "valid"
  }
/>

      <h2>
        {ticket.checkedInCount} of {ticket.quantity} Used
      </h2>

      {partiallyCheckedIn && (
        <p
          style={{
            fontSize: 24,
            color: "#d97706",
            marginBottom: 30,
          }}
        >
          Remaining: {remaining}
        </p>
      )}

      <Form method="post">
       <CheckInButton>
  {ticket.checkedInCount === 0
    ? "CHECK IN"
    : "ADMIT ONE"}
</CheckInButton>
      </Form>
    </>
  )}
</div>
    </main>
  );
}