import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Html5Qrcode,
} from "html5-qrcode";

export default function SelfCheckInPage() {
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const resetTimerRef = useRef(null);

  const [result, setResult] =
    useState(null);

  const [checkingIn, setCheckingIn] =
    useState(false);

  const [cameraFacing, setCameraFacing] =
    useState("user");

  function resetKiosk() {
    if (resetTimerRef.current) {
      clearTimeout(
        resetTimerRef.current,
      );

      resetTimerRef.current = null;
    }

    setResult(null);
    setCheckingIn(false);

    processingRef.current = false;
  }

  function scheduleReset() {
    if (resetTimerRef.current) {
      clearTimeout(
        resetTimerRef.current,
      );
    }

    resetTimerRef.current =
      setTimeout(() => {
        resetKiosk();
      }, 5000);
  }

  useEffect(() => {
    let scanner;
    let active = true;

    function extractTicketCode(
      decodedText,
    ) {
      try {
        const url =
          new URL(decodedText);

        const parts =
          url.pathname
            .split("/")
            .filter(Boolean);

        if (
          parts.length !== 2 ||
          !["checkin", "ticket"].includes(
            parts[0],
          )
        ) {
          return null;
        }

        return parts[1];
      } catch {
        return null;
      }
    }

    async function handleScan(
      decodedText,
    ) {
      if (
        !active ||
        processingRef.current
      ) {
        return;
      }

      processingRef.current = true;

      const ticketCode =
        extractTicketCode(
          decodedText,
        );

      if (!ticketCode) {
        setResult({
          result: "INVALID",
          message:
            "This is not a valid IDA ticket.",
        });

        scheduleReset();

        return;
      }

      try {
        const response =
          await fetch(
            `/api/checkin/${encodeURIComponent(
              ticketCode,
            )}`,
          );

        const data =
          await response.json();

        if (!active) {
          return;
        }

        setResult(data);

        // READY means the family now
        // needs to choose how many
        // guests are checking in.
        //
        // Do NOT reset automatically.
        if (
          data.result !== "READY"
        ) {
          scheduleReset();
        }
      } catch (error) {
        console.error(
          "Ticket lookup failed:",
          error,
        );

        if (!active) {
          return;
        }

        setResult({
          result: "ERROR",
          message:
            "Please see the box office.",
        });

        scheduleReset();
      }
    }

    async function startScanner() {
      scanner =
        new Html5Qrcode(
          "ida-checkin-reader",
        );

      scannerRef.current =
        scanner;

      try {
        await scanner.start(
          {
            facingMode:
              cameraFacing,
          },
          {
            fps: 10,
            qrbox: {
              width: 400,
              height: 400,
            },
          },
          (decodedText) => {
            handleScan(
              decodedText,
            );
          },
          () => {
            // Normal scan misses
            // happen constantly.
            // Ignore them.
          },
        );
      } catch (error) {
        console.error(
          "Could not start QR scanner:",
          error,
        );

        if (active) {
          setResult({
            result:
              "CAMERA_ERROR",
            message:
              "Camera unavailable. Please see an IDA staff member.",
          });
        }
      }
    }

    startScanner();

    return () => {
      active = false;

      if (
        resetTimerRef.current
      ) {
        clearTimeout(
          resetTimerRef.current,
        );
      }

      if (
        scannerRef.current &&
        scannerRef.current
          .isScanning
      ) {
        scannerRef.current
          .stop()
          .catch(() => {});
      }
    };
  }, [cameraFacing]);

  async function checkInGuests(
    quantity,
  ) {
    if (
      !result ||
      result.result !== "READY" ||
      checkingIn
    ) {
      return;
    }

    setCheckingIn(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "reservationId",
        result.reservationId,
      );

      formData.append(
        "showId",
        result.showId,
      );

      formData.append(
        "quantity",
        String(quantity),
      );

      const response =
        await fetch(
          "/api/checkin-group",
          {
            method: "POST",
            body: formData,
          },
        );

      const data =
        await response.json();

      setResult(data);

      scheduleReset();
    } catch (error) {
      console.error(
        "Group check-in failed:",
        error,
      );

      setResult({
        result: "ERROR",
        message:
          "Please see the box office.",
      });

      scheduleReset();
    } finally {
      setCheckingIn(false);
    }
  }

  const isReady =
    result?.result === "READY";

  const isSuccess =
    result?.result ===
    "CHECKED_IN";

  const needsHelp =
    result?.result ===
      "PAYMENT_NEEDED" ||
    result?.result ===
      "CANCELED" ||
    result?.result ===
      "ALREADY_USED";

  const resultColor =
    needsHelp
      ? "#E25186"
      : isSuccess
        ? "#15803d"
        : "#E25186";

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#ffffff",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "22px",
            fontWeight: "700",
            letterSpacing: "3px",
            marginBottom: "18px",
          }}
        >
          INSTITUTE OF DANCE ARTISTRY
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "64px",
            lineHeight: 1,
          }}
        >
          Welcome!
        </h1>

        <p
          style={{
            marginTop: "22px",
            marginBottom: "34px",
            fontSize: "28px",
            lineHeight: 1.4,
          }}
        >
          Hold your ticket QR code
          in front of the camera
          to check in.
        </p>

        <div
          style={{
            width: "100%",
            maxWidth: "520px",
            margin: "0 auto",
            padding: "18px",
            border: "3px solid #111",
            borderRadius: "24px",
            boxSizing: "border-box",
          }}
        >
          <div
            id="ida-checkin-reader"
            style={{
              width: "100%",
              overflow: "hidden",
              borderRadius: "14px",
            }}
          />
        </div>

        <p
          style={{
            marginTop: "28px",
            fontSize: "20px",
            opacity: 0.65,
          }}
        >
          Scan one ticket for your
          group.
        </p>

        <button
          type="button"
          onClick={() => {
            setCameraFacing(
              (current) =>
                current === "user"
                  ? "environment"
                  : "user",
            );
          }}
          style={{
            marginTop: "10px",
            padding: "14px 24px",
            border: "2px solid #111",
            borderRadius: "12px",
            background: "#ffffff",
            fontSize: "18px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          🔄 Switch Camera
        </button>
      </div>

      {result && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            padding: "40px",
            background: "#ffffff",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              textAlign: "center",
            }}
          >
            {isReady ? (
              <>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: "700",
                    letterSpacing:
                      "3px",
                    marginBottom:
                      "22px",
                  }}
                >
                  INSTITUTE OF DANCE
                  ARTISTRY
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: "54px",
                    lineHeight: 1.1,
                  }}
                >
                  Welcome,{" "}
                  {result.customerName}!
                </h1>

                {result.showName && (
                  <div
                    style={{
                      marginTop:
                        "18px",
                      fontSize:
                        "30px",
                      fontWeight:
                        "600",
                    }}
                  >
                    {result.showName}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "34px",
                    fontSize: "28px",
                  }}
                >
                  {result.remaining ===
                  1
                    ? "1 admission remaining"
                    : `${result.remaining} admissions remaining`}
                </div>

                <h2
                  style={{
                    marginTop: "38px",
                    marginBottom:
                      "24px",
                    fontSize: "34px",
                  }}
                >
                  How many are checking
                  in now?
                </h2>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "center",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  {Array.from(
                    {
                      length:
                        result.remaining,
                    },
                    (_, index) =>
                      index + 1,
                  ).map(
                    (quantity) => (
                      <button
                        key={
                          quantity
                        }
                        type="button"
                        disabled={
                          checkingIn
                        }
                        onClick={() =>
                          checkInGuests(
                            quantity,
                          )
                        }
                        style={{
                          width: "110px",
                          height: "110px",
                          border:
                            "3px solid #111",
                          borderRadius:
                            "20px",
                          background:
                            "#ffffff",
                          fontSize:
                            "44px",
                          fontWeight:
                            "700",
                          cursor:
                            checkingIn
                              ? "wait"
                              : "pointer",
                        }}
                      >
                        {quantity}
                      </button>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  disabled={
                    checkingIn
                  }
                  onClick={
                    resetKiosk
                  }
                  style={{
                    marginTop: "38px",
                    padding:
                      "12px 24px",
                    border:
                      "1px solid #999",
                    borderRadius:
                      "10px",
                    background:
                      "#ffffff",
                    fontSize: "18px",
                    cursor:
                      "pointer",
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: "90px",
                    lineHeight: 1,
                    marginBottom:
                      "24px",
                    color:
                      resultColor,
                  }}
                >
                  {isSuccess
                    ? "✓"
                    : needsHelp
                      ? "!"
                      : "✕"}
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: "58px",
                    lineHeight: 1.1,
                    color:
                      resultColor,
                  }}
                >
                  {isSuccess
                    ? "CHECKED IN!"
                    : result.result ===
                          "PAYMENT_NEEDED"
                      ? "Payment Needed"
                      : result.result ===
                            "ALREADY_USED"
                        ? "Already Used"
                        : result.result ===
                              "CANCELED"
                          ? "Ticket Canceled"
                          : "Please See IDA Staff"}
                </h1>

                {result.customerName && (
                  <div
                    style={{
                      marginTop:
                        "28px",
                      fontSize:
                        "34px",
                      fontWeight:
                        "700",
                    }}
                  >
                    {
                      result.customerName
                    }
                  </div>
                )}

                {result.showName && (
                  <div
                    style={{
                      marginTop:
                        "12px",
                      fontSize:
                        "28px",
                    }}
                  >
                    {result.showName}
                  </div>
                )}

                {isSuccess &&
                  result.admitted && (
                    <div
                      style={{
                        marginTop:
                          "28px",
                        fontSize:
                          "34px",
                        fontWeight:
                          "700",
                        color:
                          "#15803d",
                      }}
                    >
                      {result.admitted}{" "}
                      {result.admitted ===
                      1
                        ? "guest"
                        : "guests"}{" "}
                      checked in
                    </div>
                  )}

                <p
                  style={{
                    marginTop:
                      "28px",
                    fontSize: "25px",
                    lineHeight: 1.4,
                  }}
                >
                  {result.message}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}