import styles from "./page.module.css";
import PsychroChart from "./chart";

const history = [
  { time: 1705234737316, temperature: 20.3, humidity: 26.4 },
  { time: 1705239233754, temperature: 20.2, humidity: 26.4 },
  { time: 1705246411062, temperature: 19.9, humidity: 26.6 },
  { time: 1705253588257, temperature: 19.7, humidity: 27.7 },
  { time: 1705260765972, temperature: 19.9, humidity: 28.0 },
  { time: 1705267942433, temperature: 19.9, humidity: 27.7 },
  { time: 1705275119565, temperature: 19.9, humidity: 27.8 },
  { time: 1705282295873, temperature: 19.8, humidity: 28.1 },
  { time: 1705289472337, temperature: 19.8, humidity: 28.5 },
  { time: 1705296648829, temperature: 19.9, humidity: 28.7 },
  { time: 1705303825421, temperature: 20.0, humidity: 30.0 },
  { time: 1705311001880, temperature: 20.2, humidity: 29.9 },
  { time: 1705318179531, temperature: 25.0, humidity: 31.5 },
];

export default function Page() {
  return (
    <main className={styles.main}>
      <PsychroChart history={history} />
    </main>
  );
}
