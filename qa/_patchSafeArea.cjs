const fs = require("fs");
const p = "C:/workspace/insurance-mobile/src/components/AddressSearchField.tsx";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("react-native-safe-area-context")) {
  s = s.replace(
    'import { Modal, StyleSheet, View } from "react-native";',
    'import { Modal, StyleSheet, View } from "react-native";\nimport { SafeAreaView } from "react-native-safe-area-context";'
  );
}
if (!s.includes("<SafeAreaView style={styles.modal}")) {
  s = s.replace(
    "<View style={styles.modal}>",
    '<SafeAreaView style={styles.modal} edges={["top", "bottom"]}>'
  );
  // close tag: only the modal wrapper View that follows modalHeader/webview
  s = s.replace(
    /(style=\{styles\.webview\}\s*\/>\s*)<\/View>(\s*<\/Modal>)/,
    "$1</SafeAreaView>$2"
  );
}
fs.writeFileSync(p, s, "utf8");
const out = fs.readFileSync(p, "utf8");
console.log("hasSafeImport", out.includes("react-native-safe-area-context"));
console.log("hasSafeOpen", out.includes('<SafeAreaView style={styles.modal} edges={["top", "bottom"]}>'));
console.log("hasSafeClose", out.includes("</SafeAreaView>"));
const i = out.indexOf("<Modal");
console.log(out.slice(i, i + 420));