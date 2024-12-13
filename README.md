# IoT Pipeline Project Documentation

## Overview

This project establishes an IoT data pipeline connecting a Raspberry Pi Pico W running MicroPython to a cloud-based infrastructure using a VPS with Ubuntu 24.04 LTS, Node.js 23, InfluxDB v2.7.10, and Nginx v1.24.0.

---

## System Architecture

### Components:

- **IoT Device:** Raspberry Pi Pico W
- **Backend:** Node.js
- **Frontend:** Vite + React
- **Database:** InfluxDB
- **Web Server:** Nginx
- **Operating System:** Ubuntu 24.04 LTS (VPS)

---

## Implementation Details

### 1. IoT Device Setup

- **Language:** MicroPython
- **Data Collection:** Temperature and humidity sensors
- **Data Transmission:** HTTP POST requests to the backend API.

#### Embedded Code Snippet

```python
from machine import Pin
from dht import DHT11
from utime import sleep
import time
from network import WLAN
import network
import urequests as requests

# Initial values
# Initialize DHT11 Sensor
dhtPin = 0
dht = DHT11(Pin(dhtPin, Pin.IN))
LED = Pin("LED",Pin.OUT)

INTERVAL = 20 # 20 seconds for cloud

# Wifi Details
WF_SSID = "DN.Matthias"
WF_PASS = "idontknow"

# REST API Details
BASE_URL = "http://68.219.251.214/db_api/api/v1/"
DATA_ENDPOINT = "/embed"
DEBUG = True

def log(data)->None:
    if DEBUG:
        print(repr(data))
    return None

def sendData(endpoint: str, humidity: int)->None:
    url = f"{BASE_URL}/{endpoint}?value={humidity}"
    try:
        log("Sending request to {url}")
        res = requests.get(url)
        log(f"Response status: {res.status_code}")
        log(f"Response message: {res.text}")
    except Exception as error:
        print("Error:",error)


def connectWifi()->WLAN:
    wlan = network.WLAN(network.STA_IF)
    print("Connecting", end="")
    wlan.active(True)
    wlan.connect(WF_SSID,WF_PASS)
    while not wlan.isconnected():
        print("\n...",end="")
        time.sleep(0.1)
    print("\nConnected!")
    log(wlan.ifconfig())
    return wlan

def main()->None:
    print("Program starting.")
    wlan = connectWifi()

    while True:
        dht.measure()
        humid = dht.humidity()
        print('Humidity:', humid, '%')
        LED.on()
        sendData(DATA_ENDPOINT,humid)
        time.sleep(0.2)
        LED.off()
        time.sleep(INTERVAL)


main()
```

---

### 2. Backend API

- **Framework:** Express.js
- **Functionality:** Receive, sanitize, and store incoming data in InfluxDB.

#### Backend Code Snippet

```javascript
import express from "express";
import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { getEnvs } from "./envs.mjs";
const ENV = getEnvs();
const app = express();
console.log(ENV.INFLUX.HOST);
// 1.2 Initialize DB connection
const DB_CLIENT = new InfluxDB({
  url: ENV.INFLUX.HOST,
  token: ENV.INFLUX.TOKEN,
});
const DB_WRITE_POINT = DB_CLIENT.getWriteApi(ENV.INFLUX.ORG, ENV.INFLUX.BUCKET);
DB_WRITE_POINT.useDefaultTags({ app: "db_api" });
// Endpoint - embed
app.get("/api/v1/", (_, res) => res.sendStatus(200));
app.get("/api/v1/embed", async (req, res) => {
  try {
    const value = req.query.value;
    const numeric_value = parseFloat(value);
    const point = new Point("qparams");
    point.floatField("value", numeric_value);
    DB_WRITE_POINT.writePoint(point); // starts transaction
    await DB_WRITE_POINT.flush(); // end the transaction => save
    res.send(`Value: '${value}' written.`);
  } catch (err) {
    console.error(err);
    // console.log({ db: ENV.INFLUX.HOST });
    res.sendStatus(500);
  }
});

// Enpoints - base
app.get("", (_, res) => res.send("OK"));

// Enpoints - test query params
app.get("/test", (req, res) => {
  console.log(req.query);
  res.send("received queryparams!");
});

// Enpoints - Fetch data from InfluxDB
app.get("/api/v1/getData", async (req, res) => {
  const query = `
        from(bucket: "${ENV.INFLUX.BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "qparams")
        |> filter(fn: (r) => r._field == "value")
    `;

  try {
    const data = [];
    const DB_READ_API = DB_CLIENT.getQueryApi(ENV.INFLUX.ORG);

    await DB_READ_API.queryRows(query, {
      next(row, tableMeta) {
        const res = tableMeta.toObject(row);
        data.push(res);
      },
      error(error) {
        console.error("Error during query:", error);
        res.status(500).send("Error fetching data from InfluxDB");
      },
      complete() {
        if (data.length === 0) {
          res.status(404).send("No data found");
        } else {
          res.json(data);
        }
      },
    });
  } catch (err) {
    console.error("Error in /get-data route:", err); // Log lỗi nếu có
    res.status(500).send("Error fetching data from InfluxDB");
  }
});

app.listen(ENV.PORT, ENV.HOST, () => {
  console.log(`Listening http://${ENV.HOST}:${ENV.PORT}`);
});
```

#### Loading Env Variables Code Snippet

```javascript
/**
 * @typedef {object} INFLUX_CONF
 * @property {string} HOST Address to influxDB
 * @property {string} ORG Organization
 * @property {string} BUCKET Bucket name
 * @property {string} TOKEN Token name
 */

/**
 * @typedef {object} ENV
 * @property {number} PORT 1024-65535
 * @property {string} HOST IP or FQDN(Fully Qualified Domain Name)
 * @property {INFLUX_CONF} INFLUX
 */

/** @type {ENV} */
const ENV = {
  PORT: -1,
  HOST: "",
  INFLUX: {
    HOST: "",
    ORG: "",
    BUCKET: "",
    TOKEN: "",
  },
};

/**
 * Gets the environment variables.
 * @returns {ENV}
 * @throws {Error}
 */
export const getEnvs = () => {
  if (ENV.PORT == -1) {
    try {
      // Load host address
      ENV.HOST =
        process.env.HOST !== undefined
          ? process.env.HOST
          : () => {
              throw new Error("HOST is not defined in the .env");
            };
      const port = parseInt(process.env.PORT, 10);
      if (isNaN(port) || port < 1024 || port > 65535) {
        throw new Error("PORT must be 1024-65535.");
      }
      ENV.PORT = port;
      // Influx
      ENV.INFLUX.HOST = process.env.DB_INFLUX_HOST || "http://localhost:8086";
      ENV.INFLUX.ORG = process.env.DB_INFLUX_ORG
        ? process.env.DB_INFLUX_ORG
        : () => {
            throw new Error("DB_INFLUX_ORG undefined.");
          };
      ENV.INFLUX.BUCKET = process.env.DB_INFLUX_BUCKET
        ? process.env.DB_INFLUX_BUCKET
        : () => {
            throw new Error("DB_INFLUX_BUCKET undefined.");
          };
      ENV.INFLUX.TOKEN = process.env.DB_INFLUX_TOKEN
        ? process.env.DB_INFLUX_TOKEN
        : () => {
            throw new Error("DB_INFLUX_TOKEN undefined.");
          };
      return ENV;
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  } else {
    return ENV;
  }
};
```

---

### 3. Data Visualization

- **Dashboard:** Custom React+ Chart.js for live data representation.

#### Frontend Code Snippet

```javascript
import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maxHumidity, setMaxHumidity] = useState(null);
  const [minHumidity, setMinHumidity] = useState(null);
  const [meanHumidity, setMeanHumidity] = useState(null);

  useEffect(() => {
    fetch("/api/db_api/api/v1/getData/")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);

        // Find the day with the highest and lowest humidity
        const maxData = data.reduce(
          (max, item) => (item._value > max._value ? item : max),
          data[0]
        );
        const minData = data.reduce(
          (min, item) => (item._value < min._value ? item : min),
          data[0]
        );

        // Calculate the mean humidity
        const sumHumidity = data.reduce((sum, item) => sum + item._value, 0);
        const meanHumidityValue = sumHumidity / data.length;

        setMaxHumidity(maxData);
        setMinHumidity(minData);
        setMeanHumidity(meanHumidityValue.toFixed(2));

        console.log(data);
      })
      .catch((error) => {
        setError(error.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  const chartData = {
    labels: data.map((item) => new Date(item._time).toLocaleString()),
    datasets: [
      {
        label: "Humidity",
        data: data.map((item) => item._value),
        borderColor: "#42A5F5",
        fill: false,
      },
    ],
  };

  return (
    <div className="dashboard">
      <h1>Humidity Data Dashboard</h1>
      {maxHumidity && (
        <p>
          Highest Humidity: {maxHumidity._value}% on{" "}
          {new Date(maxHumidity._time).toLocaleString()}
        </p>
      )}
      {minHumidity && (
        <p>
          Lowest Humidity: {minHumidity._value}% on{" "}
          {new Date(minHumidity._time).toLocaleString()}
        </p>
      )}
      {meanHumidity && <p>Mean Humidity: {meanHumidity}%</p>}
      <div className="chart-container">
        <Line data={chartData} options={{ responsive: true }} />
      </div>
    </div>
  );
};

export default App;
```

---

## Benefits of the Selected Services

- **Raspberry Pi Pico W:** Affordable and capable of running MicroPython.
- **VPS with Ubuntu:** Reliable, scalable, and supports 24/7 operation.
- **Node.js:** High-performance backend for real-time data handling.
- **InfluxDB:** Optimized for time-series data storage.
- **Nginx:** Efficient web server and reverse proxy.
- **React:** Enhancing code reusability and maintainability.

---

## Conclusion

This IoT pipeline successfully collects, processes, and visualizes sensor data in real time. The system operates continuously and ensures high availability.

### Additional Deliverables:

- **Video Presentation:** [[YouTube Video Link](https://youtu.be/FhHddqXZUsI)]
- **Source Code Repositories:** [[GitHub Repository Link](https://github.com/khoidm2004/IoT-Pipeline)]
