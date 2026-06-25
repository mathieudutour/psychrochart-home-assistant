import styles from "./page.module.css";
import PsychroChart from "./chart";

const history = [
  { temperature: "20.3", lastChanged: 1705234737315 },
  { humidity: "26.4", lastChanged: 1705234737316, temperature: "20.3" },
  { temperature: "20.2", lastChanged: 1705239233754, humidity: "26.4" },
  { temperature: "19.9", lastChanged: 1705246411062, humidity: "26.6" },
  { temperature: "19.7", lastChanged: 1705253588257, humidity: "27.7" },
  { temperature: "19.9", lastChanged: 1705260765972, humidity: "28.0" },
  { humidity: "27.7", lastChanged: 1705267942433, temperature: "19.9" },
  { humidity: "27.8", lastChanged: 1705275119565, temperature: "19.9" },
  { temperature: "19.8", lastChanged: 1705282295873, humidity: "28.1" },
  { humidity: "28.5", lastChanged: 1705289472337, temperature: "19.8" },
  { temperature: "19.9", lastChanged: 1705296648829, humidity: "28.7" },
  { temperature: "20.0", lastChanged: 1705303825421, humidity: "30.0" },
  { temperature: "20.2", lastChanged: 1705311001880, humidity: "29.9" },
  { temperature: "25.0", lastChanged: 1705318179531, humidity: "31.5" },
];

export default function Page() {
  return (
    <main className={styles.main}>
      <PsychroChart history={history} />
    </main>
  );
}
