import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
  width: 1080,
  height: 1920,
  padding: 110,
    backgroundColor: "#FFFFFF",
    justifyContent: "space-between",
  },

  header: {
    alignItems: "center",
  },

  logo: {
  width: 220,
  height: 220,
  marginBottom: 20,
},

  performance: {
  fontSize: 60,
  fontWeight: "bold",
  marginTop: 30,
  marginBottom: 20,
},

  date: {
  fontSize: 30,
  color: "#555",
},

  time: {
  fontSize: 40,
  fontWeight: "bold",
  marginTop: 8,
  marginBottom: 45,
},

  customer: {
  fontSize: 64,
  fontWeight: "bold",
  textAlign: "center",
  marginBottom: 12,
},

  qrSection: {
    alignItems: "center",
  },

  qrPlaceholder: {
  width: 520,
  height: 520,

  alignSelf: "center",
},

  qrText: {
    fontSize: 32,
  },

  ticketNumber: {
    marginTop: 40,
    fontSize: 28,
  },

  footer: {
    textAlign: "center",
    fontSize: 24,
    lineHeight: 1.6,
  },

  outerBorder: {
  position: "absolute",
  top: 18,
  left: 18,
  right: 18,
  bottom: 18,
  borderWidth: 3,
  borderColor: "#3DA5BE",
},

innerBorder: {
  position: "absolute",
  top: 28,
  left: 28,
  right: 28,
  bottom: 28,
  borderWidth: 2,
  borderColor: "#E25186",
},
});

export default function Ticket({
  ticket,
  qrCode,
}) {
  return (
    <Document>
      <Page size={[1080,1920]} style={styles.page}>

  <View style={styles.outerBorder} />

  <View style={styles.innerBorder} />

        <View style={styles.header}>

<Image
  src="https://ida-tickets-app-tb5bj.ondigitalocean.app/circle-logo.png"
  style={styles.logo}
/>

  <Text style={styles.performance}>
  {ticket.performance.name}
</Text>


          <Text style={styles.date}>
  {ticket.show.date
    ? new Date(ticket.show.date).toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }
      )
    : ""}
</Text>

          <Text style={styles.time}>
  {ticket.show.name}
</Text>

        </View>

        <View
  style={{
    alignItems: "center",
  }}
>

  <Text style={styles.customer}>
    {ticket.customerName}
  </Text>

  <Text
  style={{
    fontSize: 30,
    fontWeight: "bold",
    color: "#555555",
    letterSpacing: 1,
    textAlign: "center",
  }}
>
  GENERAL ADMISSION
  <View
  style={{
    width: 320,
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
    marginTop: 10,
    marginBottom: 35,
    alignSelf: "center",
  }}
/>
</Text>

<Text
  style={{
    fontSize: 24,
    color: "#777777",
    textAlign: "center",
    marginBottom: 10,
  }}
>
  {ticket.quantity} {ticket.quantity === 1 ? "Ticket" : "Tickets"}
</Text>

</View>

        <View style={styles.qrSection}>

            <Text
  style={{
  fontSize: 30,
  color: "#555555",
  marginBottom: 40,
  textAlign: "center",
  lineHeight: 1.4,
}}
>
  Scan on Show Day{"\n"}
for Fast Entry
</Text>

          <Image
  src={qrCode}
  style={styles.qrPlaceholder}
/>

        </View>

        <Text style={styles.footer}>
          Institute of Dance Artistry{"\n"}
          400 Commerce Drive{"\n"}
          Fort Washington, PA 19034
        </Text>

      </Page>
    </Document>
  );
}