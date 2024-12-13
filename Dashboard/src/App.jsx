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
    fetch("/api/proxy")
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
