import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { colors } from "../theme";

function open(url) {
  if (!url) return;
  Linking.openURL(url).catch(() =>
    Alert.alert("Greška", "Ne mogu otvoriti: " + url)
  );
}

function Row({ label, value, onPress }) {
  if (!value) return null;
  return (
    <TouchableOpacity
      style={styles.row}
      disabled={!onPress}
      onPress={onPress}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, onPress && styles.link]}>{value}</Text>
    </TouchableOpacity>
  );
}

export default function DetailScreen({ route }) {
  const x = route.params.item;
  const mapUrl =
    x.lat && x.lon
      ? `https://maps.google.com/?q=${x.lat},${x.lon}`
      : x.url;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.name}>{x.name}</Text>
      <View style={styles.tagRow}>
        <Text style={styles.tag}>{x.category}</Text>
        <Text style={[styles.tag, styles.tagS]}>{x.settlement}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Adresa" value={x.address} />
        <Row label="Telefon" value={x.phone} onPress={() => open("tel:" + x.phone)} />
        <Row label="Email" value={x.email} onPress={() => open("mailto:" + x.email)} />
        <Row label="Web" value={x.website} onPress={() => open(x.website)} />
        <Row
          label="Koordinate"
          value={x.lat && x.lon ? `${x.lat}, ${x.lon}` : null}
        />
        <Row label="Izvor" value={x.source} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, !x.phone && styles.off]}
          disabled={!x.phone}
          onPress={() => open("tel:" + x.phone)}
        >
          <Text style={styles.btnTxt}>📞 Nazovi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSec, !x.email && styles.off]}
          disabled={!x.email}
          onPress={() => open("mailto:" + x.email)}
        >
          <Text style={styles.btnSecTxt}>✉️ Email</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSec, !mapUrl && styles.off]}
          disabled={!mapUrl}
          onPress={() => open(mapUrl)}
        >
          <Text style={styles.btnSecTxt}>📍 Karta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  name: { fontSize: 22, fontWeight: "800", color: colors.ink },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 8, marginBottom: 14 },
  tag: {
    backgroundColor: colors.tagBg, color: colors.tagInk, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, overflow: "hidden",
  },
  tagS: { backgroundColor: "#eef1ff", color: "#0f3bd6" },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: colors.line,
  },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  rowLabel: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  rowValue: { fontSize: 15, color: colors.ink },
  link: { color: colors.blue, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: colors.blue },
  btnSec: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line },
  off: { opacity: 0.35 },
  btnTxt: { color: "#fff", fontWeight: "700" },
  btnSecTxt: { color: colors.ink, fontWeight: "700" },
});
