import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import DATA from "../data.json";
import { colors, FREE_LIMIT, PRO_KEY } from "../theme";

const CATEGORIES = Array.from(
  new Set(DATA.map((r) => r.category).filter(Boolean))
).sort();

const CSV_FIELDS = [
  "name", "category", "settlement", "address", "phone",
  "email", "website", "lat", "lon", "source", "url",
];

function csvEscape(v) {
  v = v == null ? "" : String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export default function ListScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DATA.filter((r) => {
      if (cat && (r.category || "") !== cat) return false;
      if (q) {
        const hay = ((r.name || "") + " " + (r.settlement || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, cat]);

  const withEmail = filtered.filter((r) => r.email).length;
  const withPhone = filtered.filter((r) => r.phone).length;

  async function exportCsv(pro) {
    let rows = filtered;
    let capped = false;
    if (!pro && rows.length > FREE_LIMIT) {
      rows = rows.slice(0, FREE_LIMIT);
      capped = true;
    }
    const csv = [CSV_FIELDS.join(",")]
      .concat(rows.map((r) => CSV_FIELDS.map((f) => csvEscape(r[f])).join(",")))
      .join("\n");

    const fileUri =
      FileSystem.cacheDirectory + (pro ? "leadovi_pro.csv" : "leadovi_free.csv");
    await FileSystem.writeAsStringAsync(fileUri, "﻿" + csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
    } else {
      Alert.alert("Spremljeno", fileUri);
    }
    if (capped) {
      Alert.alert(
        "FREE izvoz",
        `Ograničeno na ${FREE_LIMIT} redaka. PRO za sve.`
      );
    }
  }

  function onProExport() {
    // Alert.prompt postoji samo na iOS-u; na Androidu koristimo potvrdu (demo).
    if (Platform.OS !== "ios" || typeof Alert.prompt !== "function") {
      Alert.alert(
        "PRO izvoz",
        "U produkciji ovdje ide naplata/unos ključa. Nastaviti kao PRO (demo)?",
        [
          { text: "Odustani", style: "cancel" },
          { text: "Izvezi sve", onPress: () => exportCsv(true) },
        ]
      );
      return;
    }
    Alert.prompt(
      "PRO izvoz",
      "Unesi PRO ključ (demo: PRO-2026):",
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Izvezi",
          onPress: (key) =>
            key === PRO_KEY
              ? exportCsv(true)
              : Alert.alert("Neispravan ključ", "Radim FREE izvoz.", [
                  { text: "OK", onPress: () => exportCsv(false) },
                ]),
        },
      ],
      "plain-text"
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Text style={{ fontSize: 16 }}>🔎</Text>
        <TextInput
          style={styles.search}
          placeholder="Pretraži naziv ili naselje…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {[""].concat(CATEGORIES).map((c) => {
          const on = cat === c;
          return (
            <TouchableOpacity
              key={c || "all"}
              onPress={() => setCat(c)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                {c || "Sve"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.meta}>
        {filtered.length} objekata · {withEmail} s emailom · {withPhone} s telefonom
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => (item.url || item.name || "") + i}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("Detail", { item })}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.addr}>{item.address || item.settlement}</Text>
            <View style={styles.tagRow}>
              <Text style={styles.tag}>{item.category}</Text>
              <Text style={[styles.tag, styles.tagS]}>{item.settlement}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nema rezultata 🔍</Text>
        }
      />

      <View style={styles.fab}>
        <TouchableOpacity
          style={[styles.fabBtn, styles.fabSec]}
          onPress={() => exportCsv(false)}
        >
          <Text style={styles.fabSecTxt}>⬇ CSV (FREE)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabBtn} onPress={onProExport}>
          <Text style={styles.fabTxt}>★ Sve (PRO)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", margin: 12, marginBottom: 6,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.line,
  },
  search: { flex: 1, fontSize: 16, color: colors.ink },
  chips: { flexGrow: 0, marginBottom: 4 },
  chip: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipTxt: { fontSize: 13, color: colors.ink },
  chipTxtOn: { color: "#fff" },
  meta: { color: colors.muted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 6 },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.line,
  },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  addr: { color: colors.muted, fontSize: 13, marginTop: 2, marginBottom: 10 },
  tagRow: { flexDirection: "row", gap: 6 },
  tag: {
    backgroundColor: colors.tagBg, color: colors.tagInk, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 2, fontSize: 11, overflow: "hidden",
  },
  tagS: { backgroundColor: "#eef1ff", color: "#0f3bd6" },
  empty: { textAlign: "center", color: colors.muted, padding: 40 },
  fab: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  fabBtn: {
    flex: 1, borderRadius: 12, padding: 14, alignItems: "center",
    backgroundColor: colors.blue,
  },
  fabSec: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line },
  fabTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  fabSecTxt: { color: colors.ink, fontWeight: "700", fontSize: 14 },
});
